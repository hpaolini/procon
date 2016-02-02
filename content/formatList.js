/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

"use strict";

this.TYPE = {
    SITES : 0,
    WORDS : 1
};

/**
 * Prepare strings containing unicode characters
 */
function format (str, type) {
    var list = "",
        i,
        len = str.length,
        character,
        hexVal,
        array;

    // convert unicode characters
    for (i= 0; i < len; i++) {
        character = str.charCodeAt(i);
        if (character > 127) {
            hexVal = Number(character).toString(16);
            list += "\\u" + ("000" + hexVal).match(/.{4}$/)[0];
            continue;
        }
        list += str.charAt(i);
    }

    // remove trailing newlines
    list = "\n" + list + "\n";
    array = list.split(/[\r\n]+/);
    array.pop();
    array.shift();

    list = (type === TYPE.WORDS)
        ? "(?:^|\\b|\\s)(?:" + array.join("|") + ")(?:$|\\b|\\s)"
        : array.join("|");

    return list;
}
