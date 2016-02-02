/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

(function () {
    "use strict";

    const branch = "extensions.procon.subscriptions.",
          contentPath = "chrome://procon/content/",
          Ci = Components.interfaces,
          Cc = Components.classes,
          Cu = Components.utils;

    var preferences = {},
        jsObject = {};

    const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
    const {console} = Cu.import("resource://gre/modules/Console.jsm", {});

    Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");

    function getFromURL (url) {
        var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest),
            jsStr;

        try {
            req.open("GET", url, false);
            req.overrideMimeType("text/plain");
            req.send(null);
            if (req.status == 200 || req.status == 0) {
                jsStr = req.responseText;
                if (!isValid(jsStr, url)) {
                    console.log("Invalid subscription: " + url);
                } else {
                    return true;
                }
            } else {
                console.log("Error loading subscription: " + url);
            }
        } catch (e) {
            return false;
        }

        return false;
    }
 
    function isValid (jsStr, url) {
        var linebreak = "\n",
            arr,
            listRe,
            i,
            len,
            element,
            name,
            index,
            value,
            firstVal,
            list,
            _jsObject = {};

        if (!jsStr) {
            return false;
        }
            
        if (/(\r\n?|\n\r?)/.test(jsStr)) {
            linebreak = RegExp.$1;
        }
        
        arr = jsStr.split(linebreak);

        if (!arr) {
            return false;
        }

        if (!(new RegExp("procon latte", "gi")).test(arr[0])) {
            return false;
        }

        listRe = new RegExp("^(?:profanitylist\\.words|blacklist\\.(?:sites|words)|whitelist\\.sites)", "i");

        for (i = 1, len = arr.length; i < len; i++) {
            element = arr[i];

            if (element.length < 3 || /^\s*#/m.test(element)) {
                continue;
            }

            if (listRe.test(element)) {
                name = element.match(listRe)[0];
                index = element.indexOf("=");

                if (index <= 0) {
                    continue;
                }

                value = [];
                firstVal = element.substring(index + 1, element.length).replace(/^\s+|\s+$/g, "");
                    
                if (firstVal.length > 0) {
                    value.push(firstVal);
                }
                
                while (arr[++i] && arr[i].length > 0 && !(listRe.test(arr[i]))) {
                    value.push(arr[i]);
                }

                i--;

                list = value.join("\n");
                
                _jsObject[name] = {};
                
                // check if list is already formatted as regex pattern
                if (/^\/.*\/$/g.test(list)) {
                    list = list.replace(/^\/|\/$/g, "");
                    _jsObject[name].regexReady = true;
                }
                
                _jsObject[name].list = list;
            }
        }
        
        jsObject[encodeURIComponent(url)] = _jsObject;
        return true;
    }

    function save (urls) {
        var blacklist_sites = preferences.getPrefByType(branch + "blacklist.sites"),
            blacklist_words = preferences.getPrefByType(branch + "blacklist.words"),
            whitelist_sites = preferences.getPrefByType(branch + "whitelist.sites"),
            profanitylist_words = preferences.getPrefByType(branch + "profanitylist.words"),
            list = {};

        Services.scriptloader.loadSubScript(contentPath + "formatList.js", list, "UTF-8");

        try {
            blacklist_sites = JSON.parse(blacklist_sites);
            blacklist_words = JSON.parse(blacklist_words);
            whitelist_sites = JSON.parse(whitelist_sites);
            profanitylist_words = JSON.parse(profanitylist_words);
        } catch (e) {
            console.log("Error saving subscriptions: " + e);
            return;
        }
     
        for (var i in jsObject) {
            let obj = jsObject[i];
            
            if (obj.hasOwnProperty("blacklist.sites")) {
                let bsObj = obj["blacklist.sites"];
                blacklist_sites[i] = (bsObj.hasOwnProperty("regexReady") && bsObj.regexReady)
                    ? bsObj.list
                    : list.format(bsObj.list, list.TYPE.SITES);
            }
            
            if (obj.hasOwnProperty("blacklist.words")) {
                let bwObj = obj["blacklist.words"];
                blacklist_words[i] = (bwObj.hasOwnProperty("regexReady") && bwObj.regexReady)
                    ? bwObj.list
                    : list.format(bwObj.list, list.TYPE.WORDS);
            }
            
            if (obj.hasOwnProperty("whitelist.sites")) {
                let wsObj = obj["whitelist.sites"];
                whitelist_sites[i] = (wsObj.hasOwnProperty("regexReady") && wsObj.regexReady)
                    ? wsObj.list
                    : list.format(wsObj.list, list.TYPE.SITES);
            }
            
            if (obj.hasOwnProperty("profanitylist.words")) {
                let pwObj = obj["profanitylist.words"];
                profanitylist_words[i] = (pwObj.hasOwnProperty("regexReady") && pwObj.regexReady)
                    ? pwObj.list
                    : list.format(pwObj.list, list.TYPE.WORDS);
            }
        }
        
        // remove old subscriptions
        let len = urls.length;
        for (var i in blacklist_sites) {
            let found = false;
            for (var j = 0; j < len; j++) {
                if (i == urls[j]) {
                    found = true;
                }
            }

            if (!found) {
                delete blacklist_sites[i];
            }
        }

        for (var i in blacklist_words) {
            let found = false;
            for (var j = 0; j < len; j++) {
                if (i == urls[j]) {
                    found = true;
                }
            }

            if (!found) {
                delete blacklist_words[i];
            }
        }

        for (var i in whitelist_sites) {
            let found = false;
            for (var j = 0; j < len; j++) {
                if (i == urls[j]) {
                    found = true;
                }
            }

            if (!found) {
                delete whitelist_sites[i];
            }
        }
        
        for (var i in profanitylist_words) {
            let found = false;
            for (var j = 0; j < len; j++) {
                if (i == urls[j]) {
                    found = true;
                }
            }

            if (!found) {
                delete profanitylist_words[i];
            }
        }

        preferences.setPrefByType(branch + "blacklist.sites", JSON.stringify(blacklist_sites));
        preferences.setPrefByType(branch + "blacklist.words", JSON.stringify(blacklist_words));
        preferences.setPrefByType(branch + "whitelist.sites", JSON.stringify(whitelist_sites));
        preferences.setPrefByType(branch + "profanitylist.words", JSON.stringify(profanitylist_words));
    }

    function update () {
        var urls, i, len, time;

        try {
            urls = JSON.parse(preferences.getPrefByType(branch + "urls"));

            for (i = 0, len = urls.length; i < len; i++) {
                getFromURL(decodeURIComponent(urls[i]));
            }

            save(urls);
            time = (new Date()).getTime() / 1000;
            preferences.setPrefByType(branch + "lastUpdateTime", time);
        } catch (e) {
            return false;
        }

        // console.log("ProCon: Subscriptions updated successfully...");
        return true;
    }

    update();
}());
