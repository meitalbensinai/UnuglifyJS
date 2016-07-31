#! /usr/bin/env node
// -*- js -*-

"use strict";

var UglifyJS = require("../tools/node");
var sys = require("util");
var yargs = require("yargs");
var fs = require("fs");
var http = require('http');
var json = require("../package.json");

var ARGS = yargs
	.usage("$0 input1.js \n")
	.describe("rename", "Renames variables names with names learnt from large amount of non-obfuscated JavaScript code")
	.describe("nice2predict_server", "server URL used in renaming")
	.describe("print_ast", "Prints a dot file describing the internal abstract syntax tree")
	.describe("nice_formatting", "Prints the results nicely formatted")
	.describe("skip_minified", "Whether to skip processing minified files")
	.describe("extract_features", "extract features into JSON")
	.describe("features", "Comma separated list of features: \n" + 
         "ASTREL - relations in AST, \n" + 
         "FNAMES - function names to internal calls,\n" +
		 "FSCOPE - add variable scope constraints.")
	.describe("package", "Build itself (UnuglifyJS) as a library")
	.describe("colored", "Add colors to the output")
	.describe("V", "Print version number and exit.")
	.describe("max_path_length", "The Maximum path length between literals to generate a feature")
	//.demand(1)
	.alias("V", "version")
	.default('features', 'ASTREL,FNAMES,FSCOPE')
	.default('nice2predict_server', 'www.nice2predict.org:5745')
	.default('rename', true)
	.default('max_path_length', 10)
	.default('evaluate', false)
	.default('original_features', false)
	.default('infer_labels', false)
	.boolean("rename")
	.boolean('extract_features')
	.boolean('original_features')
	.boolean('evaluate')
	.boolean("print_ast")
	.boolean("skip_minified")
	.boolean("infer_labels")
	.boolean("nice_formatting")
	.boolean("package")
	.boolean("V")
	.boolean("colors")
	.string('max_path_length')
	.string("features")
	.string("nice2predict_server")
	.wrap(80)
	.check(function(argv, options){
		if (argv._.length == 0 && !argv.package && !argv.version){
			throw "ERROR: ".red + "Nothing to analyze. No input file provided.";
		}
	})
	.argv
;

normalize(ARGS);

if (ARGS.colors){
	require("colors");
} else {
	// in case we dont use colors simply return the string
	var addProperty = function (color, func) {
		String.prototype.__defineGetter__(color, func);
	};

	addProperty('red', function () {
		return this;
	});

	addProperty('green', function () {
		return this;
	});

	addProperty('yellow', function () {
		return this;
	});
}

if (ARGS.version || ARGS.V) {
	//var json = require("../package.json");
	sys.puts(json.name + ' ' + json.version);
	process.exit(0);
}

if (ARGS.h || ARGS.help) {
	sys.puts(yargs.help());
	process.exit(0);
}

var files = ARGS._.slice();
if (files.length > 1) {
	sys.error("WARNING: expected only single input file. Processing file '" + files[0] + "' while the rest is ignored.");
}

if (ARGS.features === true) {
	sys.error("ERROR: empty set of features.");
	process.exit(1);
}

//http request does not handle http:// and https:// prefixes
ARGS.nice2predict_server = ARGS.nice2predict_server.replace(/^(http:\/\/|https:\/\/)/, '');
var HOST = ARGS.nice2predict_server.split(":")[0];
var PORT = parseInt(ARGS.nice2predict_server.split(":")[1]);

//make only one mode active
if (ARGS.extract_features || ARGS.evaluate){
	ARGS.rename = false;
}

var features = ARGS.features.split(",");
for (var i = 0; i < features.length; i++) {
	if (features[i] != "FNAMES" && features[i] != "ASTREL" && features[i] != "FSCOPE") {
		sys.error("WARNING: ignoring not supported feature '" + features[i] + "'.");
	}
}

if (ARGS.package) {
	if (files.length > 0) {
		sys.error("WARN: ".yellow + "Ignoring input files since --package was passed");
	}
	files = UglifyJS.FILES;
	ARGS.wrap = "UglifyJS";
	ARGS.export_all = true;

}

var json_rpc_id = 0;
var TOPLEVEL = null;

for (var i = 0; i < files.length; i++) {
	processFile(files[i]);
}

function processFile(file) {
	var code;
	try {
		code = fs.readFileSync(file, "utf-8");
	}
	catch (ex) {
		sys.error("ERROR:".red + " can't read file '" + file + "'");
		return;
	}

	//if it is a script, the UglifyJS parser will fail to parse it
	code = stripInterpreter(code);

	if (ARGS.package){
		try {
			TOPLEVEL = UglifyJS.parse(code, {
				filename     : file,
				toplevel     : TOPLEVEL
			});
		} catch(ex) {
			if (ex instanceof UglifyJS.JS_Parse_Error) {
				sys.error("Parse error at " + file + ":" + ex.line + "," + ex.col);
				sys.error(ex.message);
				sys.error(ex.stack);
				process.exit(1);
			}
			throw ex;
		}
		return;
	}

	try {
		var output = UglifyJS.extractFeatures(code, file, ARGS.print_ast, ARGS.max_path_length, ARGS.skip_minified, ARGS.original_features, ARGS.features);
	} catch (ex){
		if (ex instanceof UglifyJS.Parse_Error){
			sys.error("ERROR: ".red + "cannot parse file '" + file + "': " + ex.message);
		} else if (ex instanceof  UglifyJS.Minified_Error){
			//sys.error("WARN: ".yellow + "skipping minified file '" + file + "'");
		} else {
			sys.error("ERROR: ".red + "'" + file + "': " + ex);
			sys.error(ex.stack);
		}

		return;
	}

	if (output == null) {
		return;
	}

	if (ARGS.print_ast){
		console.log(output);
		return;
	}

	if (!ARGS.nice_formatting) {
		output = removeWhitespace(output);
	}
	global.gc();

	//validate JSON
	var features_result;
    try {
		features_result = JSON.parse(output);
    } catch (e) {
		sys.error("ERROR: ".red + "output is not valid JSON " + "'" + file + "'");
        throw e;
    }

	var original_features = JSON.parse(JSON.stringify(features_result));
	global.gc();
	if (ARGS.infer_labels) {
		for (var i = 0, length = features_result.assign.length ; i < length; i++) {
			var current = features_result.assign[i];
			if (current.hasOwnProperty("giv")) {
				current.inf = "giv";
				delete current.giv;
			} else if (current.hasOwnProperty("inf")) {
				current.inf = "inf";
			}
		}
		output = JSON.stringify(features_result);
	}

	/*if (removeWhitespace(output) == '{"query":[],"assign":[]}') {
		sys.error("WARN: ".yellow + " no features extracted '" + file + "'");
	} else {
		//sys.error("OK: ".green + "'" + file + "'");
	}*/

	if (ARGS.extract_features) {
		if (output.length > '{"query":[],"assign":[]}'.length) {
			console.log(output);
		}

		return;
	}

	if (ARGS.evaluate) {
		var originalNames = [];
		for (var i=0 ; i< features_result.assign.length ; i++) {
			var currentAssignItem = features_result.assign[i];
			var originalId = currentAssignItem.v;
			var originalName;
			if (currentAssignItem.hasOwnProperty("inf")) {
				originalName = currentAssignItem.inf;
			} else {
				originalName = currentAssignItem.giv;
			}
			originalNames[originalId] = originalName;
		}
		var minified = UglifyJS.minify([file], {compress: false});
		var minifiedFeaturesJson = UglifyJS.extractFeatures(minified.code, file, ARGS.print_ast, ARGS.max_path_length, false, ARGS.original_features, ARGS.features);
		minified = null;
		global.gc();
		var minifiedFeatures = JSON.parse(minifiedFeaturesJson);
		minifiedFeaturesJson = null;
		global.gc();

		callServer(
			HOST,
			PORT,
			"infer",
			minifiedFeatures,
			function(data) {
				var data_json = JSON.parse(data);
				if (data_json.hasOwnProperty('error')){
					console.log("ERROR: ".red + data_json.error.message);
				}
				else if (data_json.hasOwnProperty('result')) {
					var result = data_json.result;
					var correctly_inferred_names = 0;
					var total_inferred = 0;
					console.log(file);
					for (var i = 0; i < result.length; i++) {
						if (result[i].hasOwnProperty("inf")) {
							total_inferred++;
							var id = result[i].v;
							var inferredName = result[i].inf;
							var originalName = originalNames[id];
							var label = "error";
							if (inferredName === originalName) {
								correctly_inferred_names++;
								label = "ok";
                            }
                            console.log("\tOriginal name: \"" + originalName + "\", predicted: \"" + inferredName + "\" (" + label + ")");
						}
					}
					console.log(correctly_inferred_names + " " + total_inferred);
				} else {
					sys.error("ERROR: ".red + "undefined response. Try to update unuglify-js to the latest version by 'npm update -g unuglify-js'");
				}
			},
			function(err) {
				sys.error("ERROR: ".red + "connecting to server '" + HOST + ":" + PORT + "' " + err);
			});
		return;
	}
	if (ARGS.rename){
		callServer(
			HOST,
			PORT,
			"infer",
			features_result,
			function(data) {
				var data_json = JSON.parse(data);
				if (data_json.hasOwnProperty('error')){
					console.log("ERROR: ".red + data_json.error.message);
				}
				else if (data_json.hasOwnProperty('result')) {
					var result = data_json.result;
					var inferred_names = {};
					for (var i = 0; i < result.length; i++) {
						if (result[i].hasOwnProperty("inf")) {
							inferred_names[result[i].v] = UglifyJS.unescapeString(result[i].inf).green;
						}
					}
					try {
						var renamed_features = JSON.parse(JSON.stringify(features_result));
						for (var i = 0 ; i < original_features.assign.length ; i++) {
							var current = original_features.assign[i];
							var v = current.v;
							var value;
							if (current.hasOwnProperty("giv")) {
								value = current.giv;
								delete current.giv;
							} else if (current.hasOwnProperty("inf")) {
								value = current.inf;
								delete current.inf;
							}
							var label = inferred_names[v];
							current[label] = value;
						}
						console.log(JSON.stringify(original_features, null, 1));
					} catch (ex) {
						sys.error("ERROR: ".red + "failed rename '" + file + "': " + ex);
					}
				} else {
					sys.error("ERROR: ".red + "undefined response. Try to update unuglify-js to the latest version by 'npm update -g unuglify-js'");
				}

			},
			function(err) {
				sys.error("ERROR: ".red + "connecting to server '" + HOST + ":" + PORT + "' " + err);
			});
		return;
	}
}

if (ARGS.package){
	try {
		var output = UglifyJS.OutputStream({});
	} catch(ex) {
		if (ex instanceof UglifyJS.DefaultsError) {
			sys.error(ex.msg);
			sys.error("Supported options:");
			sys.error(sys.inspect(ex.defs));
			process.exit(1);
		}
	}

	TOPLEVEL = TOPLEVEL.wrap_commonjs(ARGS.wrap, ARGS.export_all);
	TOPLEVEL.print(output);

	output = output.get();

	sys.print(output);
}

function callServer(server, port, methodName, params, success_cb, error_cb) {
	var data = {
		jsonrpc : '2.0',
		method : methodName,
		id : (++json_rpc_id)
	};
	params.version = json.version;
	data.params = params;
	var post_data = JSON.stringify(data);

	var options = {
		host: server,
		port: port,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': post_data.length
		}
	};

	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		var data = "";
		res.on('data', function (chunk) {
			data += chunk;
		});
		res.on('end', function () {
			success_cb(data);
		});
	});

	req.on('error', function(err) {
			error_cb(err);
		});

	req.write(post_data);
	req.end();
}

/* ------------------------ */

function normalize(o) {
	for (var i in o) if (o.hasOwnProperty(i) && /-/.test(i)) {
		o[i.replace(/-/g, "_")] = o[i];
		delete o[i];
	}
}

function removeWhitespace(input){
    return input.replace(/\s/g,"");
}

function stripInterpreter(code){
	if (code.slice(0,2) != "#!"){
		return code;
	}

	return code.slice(code.indexOf('\n') + 1);
}