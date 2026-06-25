import bigInt from "big-integer";
//  Global definitions

("use strict");

//  Unicode character escapes.  Named from HTML text entities

export const C_plusmn = "\xB1"; // Plus or minus sign
export const C_times = "\xD7"; // Multiplication sign
export const C_divide = "\xF7"; // Division sign
export const C_minus = "\u2212"; // Minus sign

//  Global utility functions

//  Return true zero if bigInt is either positive or negative zero
export const pzero = function(v) {
  return v.isZero() ? bigInt.zero : v;
};

//  Negate a bigInt by subtracting it from zero
const negate = function(v) {
  return bigInt.zero.subtract(v);
};

export { negate };

//	Edit an integer with commas between thousands
export const commas = function(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

//  Useful bigInts

const K10e50 = bigInt("100000000000000000000000000000000000000000000000000");
export { K10e50 };
const Km10e50 = negate(K10e50);
export { Km10e50 };
export const K10 = bigInt(10);

//operation codes
export const OP_NONE = 0;
export const OP_ADD = 1;
export const OP_SUBTRACT = 2;
export const OP_MULTIPLY = 3;
export const OP_DIVIDE = 4;
export const OP_SHIFT = 5;
