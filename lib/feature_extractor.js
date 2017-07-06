
"use strict";

var INFER = '$';
var GIVEN = '#';

var EXPECTED_MAX_NODES_PER_NONOBFUSACATED_LINE = 25;
var MAX_RATIO_SHORT_NAMES = 0.45;
var NUM_NUMBERED_LOCALS = 5;
var defunSymbol = 'Defun';
var functionSymbol = "Function";
var childIdMattersTypes = ["Call", "Dot", "Assign", "Sub"];
//var childIdMattersTypes = [];

function isMinified(toplevel, code, file){
	var numLines = code.split(/\r\n|\r|\n/).length;
	var numStatements = 0;
  	var numNames = 0;
  	var numShortNames = 0;
  	var numNumberedNames = 0;

  	toplevel.walk(new TreeWalker(function(node, descend){
  		numStatements++;
  		if (node instanceof AST_Symbol && !(node instanceof AST_This)) {  			
  			numNames++;
  			if (node.name.length <= 2 && node.name != "el" && node.name != "$") {
  				numShortNames++;
  			}
  			if (node.name.length >= 2 && node.name[0] == '_') {
  				var c2 = node.name[1];
  				if (c2 >= '0' && c2 <= '9') ++numNumberedNames;
  			}
  		}
  	}));

    return (EXPECTED_MAX_NODES_PER_NONOBFUSACATED_LINE * numLines <= numStatements) ||
        (numShortNames > numNames * MAX_RATIO_SHORT_NAMES) ||
        numNumberedNames == numNames ||
        numNumberedNames >= NUM_NUMBERED_LOCALS;
}

function replaceMangled(code, file, infered_names, max_path_length, max_path_width, original_features, hasher) {
	var toplevel;
	try {
		toplevel = parseFile(code, file);
	} catch (ex){
		throw new Parse_Error(ex);
	}

	var counters = extendAst(toplevel, original_features);
	var numberOfNodes = counters[0];
	var numberOfLeaves = counters[1];

	//feature_outputter.string_map defines what id is assigned to each node in the final output
	//therefore to assign same ids, we need to first populate string_map by running feature extraction
	var feature_outputter = new FeatureJsonOutputter();
	if (original_features) {
		generateAstFeatures(toplevel, feature_outputter);
		generateFnamesFeatures(toplevel, feature_outputter);
		generateFscopeConstraints(toplevel, feature_outputter);
	} else {
		generateAutoFeatures(toplevel, feature_outputter, max_path_length, max_path_width, numberOfNodes, numberOfLeaves, hasher);
		generateFscopeConstraints(toplevel, feature_outputter);
	}

	var stream;
	if (typeof infered_names !== 'undefined') {
		//replace variables with inferred names
		stream = OutputStream({
			beautify: true, replace_mangled: function (node) {
				var label = nodeToProperty(node).toString();
				if (node.definition() && feature_outputter.string_map.hasId(label) && feature_outputter.string_map.getId(label) in infered_names){
					return infered_names[feature_outputter.string_map.getId(label)];
				} else {
					return node.name;
				}
				//return node.definition() ? infered_names[feature_outputter.string_map.getId("$" + node.definition().id + "-" + node.name)] : node.name;
			}
		});
	} else {
		//replace variables with placeholders. Using in the online demo for interactive renaming.
		stream = OutputStream({
			beautify: true, replace_mangled: function (node) {
				if (node.definition() && feature_outputter.string_map.hasId(nodeToProperty(node).toString())){
					return "local$$" + feature_outputter.string_map.getId(nodeToProperty(node).toString());
				} else {
					return node.name;
				}
				//return node.definition() ? "local$$" + feature_outputter.string_map.getId("$" + node.definition().id + "-" + node.name) : node.name;
			}
		});
	}
	toplevel.print(stream);
	return stream.toString();
}

function Minified_Error(message) {
	this.message = message;
}

function Parse_Error(ex) {
	this.message = ex.toString();
}

function extractFeatures(code, file, print_ast, max_path_length, max_path_width, skip_minified,
						 original_features, features, hasher, skip_unary_features, include_giv_giv, predict_alone) {
	var toplevel;

	try {
		toplevel = parseFile(code, file);
	} catch (ex){
		sys.error("Parse error in file: " + file );
		sys.error(ex, ex.stack.split("\n"));
		throw new Parse_Error(ex);
	}

	// Add id property to each AST node
	var counters = extendAst(toplevel, original_features);
	var numberOfNodes = counters[0];
	var numberOfLeaves = counters[1];

	if (print_ast) {
		return printAst(toplevel);
	}

	if (skip_minified && isMinified(toplevel, code, file)){
		throw new Minified_Error("Skipping minified file");
	}

	var feature_outputter = new FeatureJsonOutputter();
	feature_outputter.openElem();
	feature_outputter.openArray("query");

	if (original_features) {
		// Old feature extraction - by AST relations and relations between a function and its variables
		if (features.indexOf("ASTREL") != -1) {
			generateAstFeatures(toplevel, feature_outputter);
		}

		if (features.indexOf("FNAMES") != -1) {
			generateFnamesFeatures(toplevel, feature_outputter);
		}

		if (features.indexOf("FSCOPE") != -1) {
			generateFscopeConstraints(toplevel, feature_outputter);
		}
	} else {
		generateAutoFeatures(toplevel, feature_outputter, max_path_length, max_path_width, numberOfNodes, numberOfLeaves, hasher, skip_unary_features, include_giv_giv, predict_alone);
		generateFscopeConstraints(toplevel, feature_outputter, predict_alone);
	}

	feature_outputter.closeArray();

	// add "assign" property to the output - list of symbols and their infer/given purpose
	feature_outputter.dumpSymbols(predict_alone);
	feature_outputter.closeElem();
	
	var result = feature_outputter.output.join("");
	feature_outputter.output = null;
	return result;
}

/* -----[ functions ]----- */

function Property(must_infer, name, annotation) {
	this.must_infer = must_infer;
	this.name = name;
	this.annotation = annotation;
}

Property.prototype.toString = function () {
	return (this.must_infer ? INFER : GIVEN) + this.name;
}

function nodeToProperty(node, parent) {
	if (node == null) {
		return null;
	}

	if (node instanceof AST_Symbol){
		if (node instanceof AST_This ){
			//return GIVEN + node.name;
			return new Property(false, node.name, "");
		}
		// AST_Symbol::unmangleable() returns true if this symbol cannot be renamed (it's either global, undeclared, or defined in scope where eval or with are in use.
		if (node.unmangleable()){
			//return GIVEN + node.name;
			return new Property(false, node.name, "");
		}		
		//return INFER + node.definition().id + "-" + node.name;
		return new Property(true, node.definition().id + "-" + node.name, "");
	} else if (node instanceof AST_Constant){
		//var name = GIVEN + String(node.value).slice(0,64);
		//name.annotation = "!" + nodeType(node) + "!";
		//return name;
		return new Property(false, String(node.value).slice(0,64), nodeType(node));
	} else if (node instanceof AST_Sub){
		//x[1], x -> expression, 1 -> property

		if (nodeToProperty(node.expression, node) == null) {
			return null;
		}
		var prop = nodeToProperty(node.expression, node);
		prop.annotation += "[]";
		return prop;
	} else if (node instanceof AST_PropAccess){
		//return GIVEN + node.property;
		return new Property(false, node.property, "");
	} else if (node instanceof AST_Defun) {
		//function foo(...) { ... }		
		return nodeToProperty(node.name, node);
	} else if (node instanceof AST_VarDef){
		// var x = function () { ... }
		return nodeToProperty(node.name, node);
	} else if (node instanceof AST_Assign){
		//x = function () { ... }
		return nodeToProperty(node.left, node);
	} else if (node instanceof AST_ObjectProperty){
		// { "x" : function () { ... } }
		//return GIVEN + node.key;
		return new Property(false, node.key, "");
	} else if (node instanceof AST_Call){
		//x.foo( function () { ... } )
		//foo( function () { ... } )
		return nodeToProperty(node.expression,  node);
	} else if (node instanceof AST_Lambda) {
		if (node.parent instanceof AST_Call){
			//'node.parent.expression != node' as lambda can call itself
			if (node.parent.expression == node) {
				return null;
			}

			if (nodeToProperty(node.parent.expression, node) == null) {
				return null;
			}

			//var name = nodeToProperty(node.parent.expression, node);
			//name.annotation = "(" + node.child_id + ")";
			//return name;
			var prop = nodeToProperty(node.parent.expression, node);
			prop.annotation += "(" + node.child_id + ")";
			return prop;
		}
		if (node.parent != parent) {
			return nodeToProperty(node.parent, node);
		}
	}

	return new Property(false, node.__proto__.TYPE);
}

function nodeType(node) {
	if (node instanceof AST_Binary || node instanceof AST_Unary) {
		return node.__proto__.TYPE + node.operator;
	} else if (node instanceof AST_Boolean) {
		return "Bool";	
	} else if (node instanceof AST_Atom && !(node instanceof AST_Constant)) {
		//atoms are special constant values as Nan, Undefined, Infinity,..
		return "Atom";
	} 

	return node.__proto__.TYPE;
}

function pathToStringFw(path, start){
	var res = "";
	for (var i = start; i < path.length - 1; i++) {
		res += nodeType(path[i]);
		res += "[" + path[i+1].child_id + "]";
	}

	return res;
}

function pathToStringBw(path, start){
	var res = "[" + path[path.length-1].child_id + "]";
	for (var i = path.length - 2; i >= start; i--) {
		res += nodeType(path[i]);
		res += "[" + path[i].child_id + "]";
	}

	return res;
}

function printAst(toplevel){
	var output = [];

	var walker = new TreeWalker(function(node){
		output.push(string_template('  node{id} [label="{label}"];\n', {
			id: node.id,
			label: nodeType(node)
		}));

		if (walker.parent() != null) {
			output.push(string_template('  node{id1} -> node{id2} [weight=1];\n', {
				id1: walker.parent().id,
				id2: node.id
			}));
		}
	});

	output.push("digraph AST {\n");
	toplevel.walk(walker);
	output.push("}\n");
	return output.join("");
}

function sameVariableByStacks(sourceStack, targetStack) {
	var sourceNode = sourceStack[sourceStack.length - 1];
	var targetNode = targetStack[targetStack.length - 1];

	if ((sourceNode.toProperty != null) && (targetNode.toProperty != null)) {
		return sourceNode.toProperty.name === targetNode.toProperty.name;
	} else {
		return false;
	}
}

function generatePathFeature(sourceStack, targetStack, max_path_length, max_path_width, predict_alone) {
	var commonPrefix = 0;

	for (var i = 0, length = Math.min(sourceStack.length, targetStack.length) ; i<length ; i++) {
		if (sourceStack[i].id === targetStack[i].id) {
			commonPrefix++;
		}
	}

	var pathLength = (sourceStack.length - commonPrefix) + (targetStack.length - commonPrefix);
	var pathWidth = Math.abs(targetStack[commonPrefix].child_id - sourceStack[commonPrefix].child_id);
	if ((pathLength > max_path_length || pathWidth > max_path_width) && (predict_alone || !sameVariableByStacks(sourceStack, targetStack))) {
		return;
	}

	var pathParts = new Array(pathLength*2 + 1);
	var pathIndex = 0;
	var nextType = sourceStack[sourceStack.length - 1].__proto__.TYPE;
	for (var i = sourceStack.length - 1 ; i >= commonPrefix ; i-- ) {
		var node = sourceStack[i];
		var nodeString = nextType;
		nextType = sourceStack[i-1].__proto__.TYPE;
		/*if (nodeString === defunSymbol) {
			return undefined;
		}*/
		if (node.hasOwnProperty('operator')) {
			nodeString += node.operator;
		}
		var shouldAddChildId = (i == sourceStack.length - 1) || (childIdMattersTypes.indexOf(nextType) !== -1);
		pathParts[pathIndex] = ('(' + nodeString + (shouldAddChildId? node.child_id : '') + ')');
		pathIndex++;
		pathParts[pathIndex] = '^';
		pathIndex++;
	}

	var commonNode = sourceStack[commonPrefix-1];
	var commonNodeString = commonNode.__proto__.TYPE;
	if (commonNodeString == defunSymbol) {
		commonNodeString = functionSymbol;
	}
	var previousType = commonNodeString;
	if (commonNode.hasOwnProperty('operator')) {
		commonNodeString += commonNode.operator;
	}
	pathParts[pathIndex] = '(' + commonNodeString + ')';
	pathIndex++;
	for (var i = commonPrefix, targetStackLength = targetStack.length ; i<targetStackLength ; i++) {
		var node = targetStack[i];
		var nodeString = node.__proto__.TYPE;
		/*if (nodeString === defunSymbol) {
			return undefined;
		}*/
		var shouldAddChildId = (i == targetStackLength -1 ) || (childIdMattersTypes.indexOf(previousType) !== -1);
		previousType = nodeString;

		if (node.hasOwnProperty('operator')) {
			nodeString += node.operator;
		}

		//pathParts.push('-[DOWN]-');
		pathParts[pathIndex] = '_';
		pathIndex++;
		pathParts[pathIndex] = ('(' + nodeString + (shouldAddChildId ? node.child_id : '') + ')');
		pathIndex++;
	}
	return pathParts;
}

function generateAutoFeaturesForSubtree(toplevel, feature_outputter, max_path_length, max_path_width, numberOfNodes, numberOfLeaves, hasher, skip_unary_features, include_giv_giv, predict_alone) {
	var nodes = new Array(numberOfNodes);
	var leaves = new Array(numberOfLeaves);

	var leavesIndex = 0;
	var walker = new TreeWalker(function(node){
		var stack = walker.stack;
		//feature_outputter.string_map.addKey(node.id);
		nodes[node.id] = [node, stack.slice()];
		if (node.num_childs === 0 && node.__proto__.TYPE != 'EmptyStatement') {
			leaves[leavesIndex] = node;
			leavesIndex++;
		}
		if (node.__proto__.TYPE == 'Dot') {
			var propertyNode = new AST_Property();
			propertyNode.id = numberOfNodes++;
			propertyNode.num_childs = 0;
			propertyNode.child_id = 0;
			propertyNode.toProperty = new Property(false, node.property, "");
			leaves[leavesIndex++] = propertyNode;
			var nodesItem = [propertyNode, stack.slice()];
			nodesItem[1].push(propertyNode);
			nodes[propertyNode.id] = nodesItem;
		}
		if (node != toplevel && (node instanceof AST_Defun || node instanceof AST_Lambda)) {
			// don't descend into functions
			return true;
		}
	});

	toplevel.walk(walker);

	for (var sourceIndex = 0 ; sourceIndex < leavesIndex ; sourceIndex++) {
		for (var targetIndex = sourceIndex + 1 ; targetIndex < leavesIndex ; targetIndex++) {

			var sourceId = leaves[sourceIndex].id;
			var targetId = leaves[targetIndex].id;
			var sourceStack = nodes[sourceId][1];
			var targetStack = nodes[targetId][1];
			var sourcePropery = nodes[sourceId][0].toProperty;
			var targetProperty = nodes[targetId][0].toProperty;

			if (sourcePropery == null || targetProperty == null) {
				continue;
			}
			if (!sourcePropery.must_infer && !targetProperty.must_infer && !include_giv_giv) {
				continue;
			}

			var featureParts = generatePathFeature(sourceStack, targetStack, max_path_length, max_path_width, predict_alone);
			// nodeToProperty hides a hidden language-specific bias - INFER/GIVEN, and types that should be inferred
			if (featureParts != undefined) {
				var feature = hasher.hashCode(featureParts.join(""));
				if (predict_alone){
                    feature_outputter.addPathFeatureForSingle(sourcePropery, targetProperty, feature, sourceId, targetId);
                } else {
                    feature_outputter.addPathFeature(sourcePropery, targetProperty, feature);
                }
				/*
				featureParts.reverse();
				for (var i=0, length = featureParts.length; i<length ; i++) {
					if (featureParts[i] === '^') {
						featureParts[i] = '_';
					} else if (featureParts[i] === '_') {
						featureParts[i] = '^';
					}
				}
				var reverseFeature = hashCode(featureParts.join(""));
				if (reverseFeature != feature) {
					feature_outputter.addPathFeature(targetProperty, sourcePropery, reverseFeature);
				}*/
			}
		}
	}
}

function generateAutoFeatures(toplevel, feature_outputter, max_path_length, max_path_width, numberOfNodes,
							  numberOfLeaves, hasher, skip_unary_features, include_giv_giv, predict_alone) {
	toplevel.walk(new TreeWalker(function(node) {
		if (node instanceof AST_Defun || node instanceof AST_Lambda) {
			generateAutoFeaturesForSubtree(node, feature_outputter, max_path_length, max_path_width, numberOfNodes, numberOfLeaves, hasher, skip_unary_features, include_giv_giv, predict_alone);
		}
	}));
}

function generateAstFeatures(toplevel, feature_outputter) {
	var walker = new TreeWalker(function(node){
		// console.log(nodeType(node) + " - " + nodeToProperty(node));
		var paths = this.node_finder.find(node);
		for (var i = 0; i < paths.length; i++) {
			var path1 = paths[i];
			var node1 = path1[path1.length - 1];

			for (var j = i + 1; j < paths.length; j++) {
				var common_prefix_len = 0;
				var path2 = paths[j];
				var node2 = path2[path2.length - 1];

				//determine common prefix to be skipped
				while(common_prefix_len < path1.length && common_prefix_len < path2.length 
					&& path1[common_prefix_len] === path2[common_prefix_len]){
					common_prefix_len++;
				}

				if (common_prefix_len == 0) {
					throw  "common prefix not greater than 0!";
				}

				feature_outputter.addFeature(
					node1.toProperty,
					node2.toProperty,
					//pathToStringBw(path1, common_prefix_len) + ":" + nodeType(path1[common_prefix_len - 1]) + ":" + pathToStringFw(path2, common_prefix_len)
					(path2.length != common_prefix_len)
						? pathToStringBw(path1, common_prefix_len) + ":" + pathToStringFw(path2, common_prefix_len - 1)
						: pathToStringBw(path2, common_prefix_len) + ":" + pathToStringFw(path1, common_prefix_len - 1)
				);

			}
		}
	});

	walker.node_finder = new NodePathFinder(3, function(node) {
		return (node instanceof AST_Symbol || node instanceof AST_Constant || node instanceof AST_PropAccess);
	});

	toplevel.walk(walker);
}

function addFeatures(lhss, lhs_label, rhs, rhs_label, feature_outputter){	
	var prefix = "";
	for (var i = lhss.length - 1; i >= 0; i--) {
		prefix += lhs_label;
		feature_outputter.addFeature(lhss[i], rhs, prefix + rhs_label);
	}
}

function addScopeConstraints(node, toplevel, feature_outputter, predict_alone){
	feature_outputter.beginScope();
	if (predict_alone){
		feature_outputter.endScope();
		return;
	}
	var name = node.toProperty;
	if (name != null && node.num_childs === 0) {
		feature_outputter.addToScope(name);
	}

	for (var i = 0; i < node.enclosed.length; i++){
		feature_outputter.addToScope(node.enclosed[i].orig[0].toProperty);
	}

	node.variables.each(function(symbol){
		feature_outputter.addToScope(symbol.orig[0].toProperty);
	});

	toplevel.globals.each(function(symbol){
		feature_outputter.addToScope(symbol.orig[0].toProperty);
	});

	feature_outputter.endScope();
}


function generateFscopeConstraints(toplevel, feature_outputter, predict_alone){
	addScopeConstraints(toplevel, toplevel, feature_outputter, predict_alone);
	if (!predict_alone){
        toplevel.walk(new TreeWalker(function(node) {
            if (node instanceof AST_Defun || node instanceof AST_Lambda) {
                addScopeConstraints(node, toplevel, feature_outputter);
            }
        }));
	}
}

function generateFnamesFeatures(toplevel, feature_outputter){
	var outer_funcs = [];

	toplevel.walk(new TreeWalker(function(node, descend){

		if ((node instanceof AST_Defun || node instanceof AST_Lambda) && node.toProperty != null) {
			var name = node.toProperty;

			for (var i = 0; i < node.argnames.length; i++) {
				addFeatures([name], "FN", node.argnames[i].toProperty, "PAR", feature_outputter);
			}

			outer_funcs.push(name);
			descend();	//traverse childs
			outer_funcs.pop();

			return true; //do not traverse childs again
		}

		if (node instanceof AST_New) {	
			addFeatures(outer_funcs, "FN", node.toProperty, "NEW", feature_outputter);
		} else if (node instanceof AST_Call) {			
			addFeatures(outer_funcs, "FN", node.toProperty, "CALL", feature_outputter);
		} else if (node instanceof AST_Constant){
			addFeatures(outer_funcs, "FN", node.toProperty, nodeType(node).toUpperCase(), feature_outputter);
		} else if (node instanceof AST_VarDef){
			addFeatures(outer_funcs, "FN", node.name.toProperty, "DECL", feature_outputter);
		} else if (node instanceof AST_Dot && !(node.parent instanceof AST_Call)) {			
			addFeatures(outer_funcs, "FN", node.toProperty, "PROP", feature_outputter);
		} else if (node instanceof AST_Return && nodeToProperty(node.value) != null) {
			addFeatures(outer_funcs, "FN", nodeToProperty(node.value), "RETURN", feature_outputter);
		}
	}));
}

/* -----[ NodePathFinder ]----- */

function NodePathFinder(max_depth, filter) { 
	this.max_depth = max_depth;
	this.paths = [];
	this.filter = filter;
}

NodePathFinder.prototype = new TreeWalker(function(node, descend){
	if (this.stack.length > this.max_depth || node instanceof AST_Defun){
		return true;
	}

	//enforce in-order traversal
	//otherwise we get for "x.foo()" feature foo - x instead of x - foo as x is a parent of foo in the AST
	descend();

	if (this.filter(node)) {
		this.paths.push(this.stack.slice(0));
	} 

	return true;
});

NodePathFinder.prototype.find = function(node) {
	this.root = node;
	this.paths = [];
	node.walk(this);
	return this.paths;
};

/* ---[ JsonOutputter ]--- */

function FeatureJsonOutputter() {
	this.string_map = new StringMap();
	this.first_element = true;
	this.output = [];
	this.depth = 0;
	this.pairs = {};
	this.cur_scope = {};
	this.has_features = false;
}

FeatureJsonOutputter.prototype.indent = function() {
	var res = "";
	for (var i = 0; i < this.depth; i++) {
		res += " ";
	}
	return res;
};

FeatureJsonOutputter.prototype.openElem = function() {
	if (!this.first_element) {
		this.output.push(",");
	}
	this.output.push("\n" + this.indent() + "{");
	this.first_element = true;
	this.depth++;
};

FeatureJsonOutputter.prototype.closeElem = function() {	
	this.depth--;
	this.output.push("}");
	this.first_element = false;	
};


FeatureJsonOutputter.prototype.openArray = function(name){
	if (!this.first_element) {
		this.output.push(",");
	}
	this.output.push("\n" + this.indent() + "\"" + name + "\":[");
	this.first_element = true;
	this.depth++;
};

FeatureJsonOutputter.prototype.closeArray = function(){
	this.depth--;
	this.output.push("\n" + this.indent() + "]");
	this.first_element = false;
};

FeatureJsonOutputter.prototype.visitFeature = function(a_id, b_id, name){
	if (! (a_id in this.pairs) ) {
		this.pairs[a_id] = [];
	}
	var visited = this.pairs[a_id];

	if (visited.indexOf(b_id + "-" + name) >= 0) {
		return true;
	}
	visited.push(b_id + "-" + name);
	return false;
};

FeatureJsonOutputter.prototype.addFeature = function(a, b, name){
	if (a == null || b == null){
		return;
	}

	//do not add features between two fixed nodes
	//if (a[0] == GIVEN && b[0] == GIVEN) {
	if (!a.must_infer && !b.must_infer) {
		return;
	}

	if (a.annotation != "") {
		name = a.annotation + "-" + name;
	}
	if (b.annotation != "") {
		name = name + "-" + b.annotation;
	}

	var a_id = this.string_map.getId(a.toString());
	var b_id = this.string_map.getId(b.toString());

	if (a_id == b_id || this.visitFeature(a_id, b_id, name)){
		return;
	}

	this.has_features = true;

	this.openElem();

	this.output.push('"a": ' + a_id + ",");
	this.output.push('\t"b": ' + b_id + ",");
	this.output.push('\t"f2": "' + name + '"');

	this.closeElem();
};

FeatureJsonOutputter.prototype.addPathFeature = function(source, target, featureString){
	this.has_features = true;
	var a_id = this.string_map.getId(source.toString());
	var b_id = this.string_map.getId(target.toString());

	/*if (a_id === b_id) {
		return;
	}*/

	this.openElem();

	this.output.push('"a": ' + a_id + ",");
	this.output.push('\t"b": ' + b_id + ",");
	this.output.push('\t"f2": "' + featureString + '"');

	this.closeElem();
};

FeatureJsonOutputter.prototype.addPathFeatureForSingle = function(source, target, featureString, sourceId, targetId){
    this.has_features = true;
    var a_id = this.string_map.getIdForSingle(source.toString(), sourceId);
    var b_id = this.string_map.getIdForSingle(target.toString(), targetId);

	/*if (a_id === b_id) {
	 return;
	 }*/

    this.openElem();

    this.output.push('"a": ' + a_id + ",");
    this.output.push('\t"b": ' + b_id + ",");
    this.output.push('\t"f2": "' + featureString + '"');

    this.closeElem();
};

FeatureJsonOutputter.prototype.addSymbol = function(key, predict_alone){
	this.openElem();
	
	this.output.push('"v": ' + this.string_map.getId(key) + ",");
	if (key[0] == INFER){
		//${id}-{name}-{node id}
		this.output.push('\t"inf": "' + escapeString(key.split("-")[1]) + '"');
	} else {
		//#{name}-{node id}
		sys.error(key + " " + predict_alone)
		if (predict_alone){
            this.output.push('\t"giv": "' + escapeString(key.split("-")[0].slice(1)) + '"');
        }
		this.output.push('\t"giv": "' + escapeString(key.slice(1)) + '"');
	}
	
	this.closeElem();
};

FeatureJsonOutputter.prototype.dumpSymbols = function(predict_alone){
	if (!this.has_features) {
		this.openArray("assign");
		this.closeArray();
		return;
	}

	this.openArray("assign");

	// var keys = Object.keys( this.string_map.map );
	var keys = this.string_map.keys;	
 	for( var i = 0,length = keys.length; i < length; i++ ) {
 		this.addSymbol(keys[i], predict_alone);
 	}

	this.closeArray();
};

FeatureJsonOutputter.prototype.beginScope = function(){
	this.cur_scope = {};
};

FeatureJsonOutputter.prototype.addToScope = function(a){
	var a_id = this.string_map.getId(a);
	this.cur_scope[a_id] = true;
};

FeatureJsonOutputter.prototype.endScope = function(){
	//{"cn":"!=","n":[14,366,370,372,108,40,356]}
	if (!this.has_features) {
		return;
	}

	var keys = Object.keys(this.cur_scope);
	if (keys.length <= 1) {
		return;
	}

	this.openElem();
	this.output.push('"cn":"!=", "n":[');

	this.output.push(keys[0]);
	for(var i = 1,length = keys.length; i < length; i++ ) {
		this.output.push(',');
		this.output.push(keys[i]);
	}

	this.output.push("]");
	this.closeElem();
};

/* -----[ StringMap ]----- */

function StringMap() {
	this.map = {};
	this.current_id = 0;
	this.keys = [];
}

StringMap.prototype.hasId = function(input){
	if (input == null){
		throw new Error("error null");
	}

	//we add a special character in from to allow for keys such as "toString"
	var escaped_input = "#" + input.toString();
	return escaped_input in this.map;
};

StringMap.prototype.getId = function(input){
	if (input == null){
		throw new Error("error null");
	}

	input = input.toString();
	//we add a special character in from to allow for keys such as "toString"
	var escaped_input = "#" + input;

	if (!(escaped_input in this.map)) {
		this.map[escaped_input] = this.current_id;

		//keep ordered map of keys for iterating later
		this.keys.push(input);
		this.current_id++;	
	}
	
	return this.map[escaped_input];
};


StringMap.prototype.getIdForSingle = function(input, node_id){
    if (input == null){
        throw new Error("error null");
    }

    input = input.toString();
    //we add a special character in from to allow for keys such as "toString"
    var escaped_input = "#" + input + "-" + node_id;

    if (!(escaped_input in this.map)) {
        this.map[escaped_input] = this.current_id;

        //keep ordered map of keys for iterating later
        this.keys.push(input + "-" + node_id);
        this.current_id++;
    }

    return this.map[escaped_input];
};


StringMap.prototype.addKey = function(input) {
	var escaped_input = "#" + input;

	if (!(escaped_input in this.map)) {
		this.map[escaped_input] = this.current_id;

		//keep ordered map of keys for iterating later
		this.keys.push(input);
		this.current_id++;
	}
}

/* ------------------------ */

function escapeString(input){
	var asterisk = "\\*";
	var regexp = new RegExp(asterisk, "g");
	try {
		var encoded = encodeURIComponent(input);
		var removeAsterisk = encoded.replace(regexp, '%2A');
		return removeAsterisk;
	} catch (ex){
		throw new Parse_Error(" unable to encode '" + input.replace(/^!(String|Number|RegExp|Atom|Bool')!/, '') + "'");
	}
}

function unescapeString(input){
	return decodeURIComponent(input);
}

function parseFile(code, file) {	
	var toplevel = parse(code, {
		filename	: file
	});
	toplevel.figure_out_scope();
	return toplevel;
}

function extendAst(root, original_features){
	var current_id = 0;
	
	var walker = new TreeWalker(function(node){
		
		if (!node.hasOwnProperty("id")){
			node.id = current_id;
			current_id += 1;
		}
		if (!node.hasOwnProperty("parent")){
			node.parent = walker.parent();
		}
		node.num_childs = 0;
		node.child_id = 0;
		if (walker.parent() !== undefined){
			node.child_id = walker.parent().num_childs;
			walker.parent().num_childs++;
		}

		if (node instanceof AST_Symbol) {
			if (node.definition() != null) {
				node.definition().id = current_id;
				current_id++;
			}
		}
	});
	root.walk(walker);

	var leavesCounter = 0;

	var propertyWalker = new TreeWalker(function(node) {
		if (original_features) {
			node.toProperty = nodeToProperty(node);
		}
		else if (node.num_childs === 0) {
			node.toProperty = nodeToProperty(node);
			leavesCounter++;
		}
	});
	root.walk(propertyWalker);
	return [current_id+1, leavesCounter];
}