"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var crc32 = require("crc-32");
function calculateRequestOpcode_1(str) {
    return (BigInt(crc32.str(str)) & BigInt(0x7fffffff)).toString(16);
}
function calculateResponseOpcode_2(str) {
    var a = BigInt(crc32.str(str));
    var b = BigInt(0x80000000);
    return ((a | b) < 0 ? (a | b) + BigInt('4294967296') : a | b).toString(16);
}
var string1 = 'op::unfreeze';
var hex = calculateRequestOpcode_1(string1);
console.log('hex opcode: ' + hex);
var hex2 = calculateResponseOpcode_2(string1);
console.log('hex opcode2: ' + hex2);
