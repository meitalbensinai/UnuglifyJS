/**
 * Created by urial on 7/7/2016.
 */
var UglifyJS = require("../tools/node");
var sys = require("util");
var yargs = require("yargs");
var fs = require("fs");
var http = require('http');
var json = require("../package.json");

var str = '* *';
console.log(UglifyJS.escapeString(str));
