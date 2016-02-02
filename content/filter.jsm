/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

"use strict";

this.EXPORTED_SYMBOLS = ["addFrameContent", "addFrameAddress", "loaded"];

const Ci = Components.interfaces,
      Cc = Components.classes,
      Cu = Components.utils;

const contentPath = "chrome://procon/content/",
      host = "procon:",
      loaded = true;

const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
//let console = (Cu.import("resource://gre/modules/Console.jsm", {})).console;

const nsIDOMHTMLScriptElementIface = Ci.nsIDOMHTMLScriptElement,
      nsIDOMHTMLStyleElementIface = Ci.nsIDOMHTMLStyleElement,
      nsIDOMXPathResultIface = Ci.nsIDOMXPathResult;

const PROTECTED_URLS = {
    "chrome://mozapps/content/extensions/extensions.xul": true,
    "chrome://global/content/config.xul": true,
    "about:config": true,
    "about:addons": true
};

const ignoredSchemes = {
    "view-source": true,
    "javascript": true,
    "resource": true,
    "chrome": true,
    "about": true,
    "data": true
};

var stringBundle = Services.strings.createBundle('chrome://procon/locale/overlay.properties?' + Math.random()),
    preferences = null;

function getPreferences () {
    return Services.cpmm.sendSyncMessage(host + "getPreferences")[0];
}

function inWhitelist (uri) {
    var spec = decodeURIComponent(uri.spec),
        host = decodeURIComponent(uri.host),
        prematchStr,
        match;

    if (typeof preferences.whitelist.session.domains[host] !== "undefined" || typeof preferences.whitelist.session.pages[spec] !== "undefined") {
        return true;
    } else if (preferences.whitelist.enabled) {
        match = -1;

        //get or store from cache
        if (typeof preferences.cache.whitelist[spec] !== "undefined") {
            match = preferences.cache.whitelist[spec];
        } else {
            match = spec.search(preferences.whitelist.sites);

            //prevent bypass of whitelist keywords via parameters
            if (match !== -1) {
                prematchStr = spec.substr(0, match);
                if (prematchStr.indexOf("?") !== -1 || prematchStr.indexOf("#") !== -1) {
                    match = -1;
                }
            }

            Services.cpmm.sendAsyncMessage(host + "filterUpdate", {fn: "setWhitelistCache", url: spec, match: match});
        }

        if (match !== -1) {
            return true;
        }
    }

    return false;
}

function scanURL (uri) {
    var uri_spec,
        match,
        msg;

    preferences = getPreferences();

    if (preferences.blacklist.enabled && preferences.blacklist.sites_enabled && typeof ignoredSchemes[uri.scheme] === "undefined") {
        if (inWhitelist(uri)) {
            return;
        }

        if (preferences.blacklist.advanced_limitNetAccess) {
            return filteredURI(uri, null); // internet-wide block
        }

        match = -1;
        uri_spec = decodeURIComponent(uri.spec);

        //get or store result from cache
        if (typeof preferences.cache.blacklist[uri_spec] !== "undefined") {
            match = preferences.cache.blacklist[uri_spec];
        } else {
            match = uri_spec.search(preferences.blacklist.sites);
            Services.cpmm.sendAsyncMessage(host + "filterUpdate", {fn: "setBlacklistCache", url: uri_spec, match: match});
        }

        if (match !== -1) {
            msg = stringBundle.GetStringFromName("addressMatched") + " " +  uri_spec.substr(match, 20);
            return filteredURI(uri, msg);
        }
    }
    return;
}

function scanContent (event) {
    let doc = event.target,
        body,
        uri,
        scanContentAllowed,
        element,
        elements = [],
        match,
        msg,
        newURI,
        cf,
        MutationObserver,
        observer,
        len;

    if (typeof PROTECTED_URLS[doc.URL.toLowerCase()] !== "undefined" && !Services.scriptloader.loadSubScript(contentPath + "authenticate.js", doc, "UTF-8")) {
        doc.location.replace("about:blank");
        return;
    }

    body = doc.body;
    preferences = getPreferences();

    if (!body || body.childElementCount === 0 || (preferences.blacklist.enabled === false && preferences.profanitylist.enabled === false)) {
        return;
    }

    uri = doc.baseURIObject;

    if (typeof ignoredSchemes[uri.scheme] !== "undefined") {
        return;
    }

    //let URI_host = decodeURIComponent(URI.host); // if URI.host is undefined, produces NS_ERROR_FAILURE on internal pages (about, view-source, etc...)

    scanContentAllowed = (preferences.blacklist.enabled && preferences.blacklist.words_enabled && !inWhitelist(uri));

    if (scanContentAllowed) {
        // check meta tags
        if (preferences.blacklist.advanced_examineMeta) {
            element = doc.evaluate('/html/head/meta[@name="description"]/@content',
                body,
                null,
                nsIDOMXPathResultIface.STRING_TYPE,
                null).stringValue;

            match = element.search(preferences.blacklist.words);
            
            if (match !== -1) {
                msg = stringBundle.GetStringFromName("metaTagMatched") + " " + element.substr(match,20);
                newURI = filteredURI(uri, msg);
                doc.location.replace(newURI);
                return;
            }
        }
    } else if (!preferences.profanitylist.enabled) {
        return;
    }

    elements.push(doc.evaluate('//text()[normalize-space()]',
        body,
        null,
        nsIDOMXPathResultIface.ORDERED_NODE_SNAPSHOT_TYPE,
        null));

    cf = new contentFilter({"document": doc, "elements": elements, "scanContentAllowed": scanContentAllowed});
    cf.scanAll();

    MutationObserver = doc.defaultView.MutationObserver;
    observer = new MutationObserver(
        function (mutations) {
            elements = [];
            mutations.forEach(
                function (mutation) {
                    len = mutation.addedNodes.length;
                    if (!len) {
                        return;
                    }

                    while (len--) {
                        elements.push(doc.evaluate('descendant-or-self::text()[normalize-space()]',
                            mutation.addedNodes[len],
                            null,
                            nsIDOMXPathResultIface.ORDERED_NODE_SNAPSHOT_TYPE,
                            null));
                    }
                });

            cf = new contentFilter({"document": doc, "elements": elements, "scanContentAllowed": scanContentAllowed});
            cf.scanAll();
        }
    );

    observer.observe(body, {childList: true, subtree: true});

    return function () {
        observer.disconnect();
    };
};

var contentFilter = function (doc) {
    this.i = 0;
    this.nodesPerBatch = 200;
    this.doc = doc.document;
    this.elements = doc.elements;
    this.content = doc.scanContentAllowed;
    this.t = "";
};

contentFilter.prototype.scan = function (element) {
    var el, data = "", j, pn, data2;

    if (!this.doc) {
        return;
    }

    for (j = 0; j <= this.nodesPerBatch; j++) {
        if (!(el = element.snapshotItem(this.i++))) {
            break;
        }

        pn = el.parentNode;

        if (pn === null || pn.nodeType === 9 || pn.nodeType === 11 || (pn.nodeType === 1 && !(pn instanceof nsIDOMHTMLScriptElementIface || pn instanceof nsIDOMHTMLStyleElementIface))) {
            data2 = el.data;
            data += data2 + " ";

            if (preferences.profanitylist.enabled && data2 !== null && preferences.profanitylist.words.test(data2)) {
                el.data = data2.replace(preferences.profanitylist.words, preferences.profanitylist.placeholder);
            }
        }
    }

    this.t += data + " ";

    if (el !== null) {
        this.i--;
        this.scan(element);
    }
};

contentFilter.prototype.scanAll = function() {
    var j, match, msg, newURI;

    for (j = 0; j < this.elements.length; j++) {
        this.i = 0;
        this.scan(this.elements[j]);
    }

    if (this.content) {
        match = this.t.search(preferences.blacklist.words);
        if (match !== -1) {
            msg = stringBundle.GetStringFromName("contentMatched") + " " + this.t.substr(match, 20);
            newURI = filteredURI(this.doc.baseURIObject, msg);
            this.doc.location.replace(newURI);
        }

        this.t = "";
    }
};

//https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#Solution_2_%E2%80%93_rewrite_the_DOMs_atob()_and_btoa()_using_JavaScript's_TypedArrays_and_UTF-8
function b64EncodeUnicode (str) {
    return encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    });
}

function filteredURI (URI, match) {
    if (preferences.blacklist.advanced_redirect) {
        return preferences.blacklist.advanced_redirectURL;
    }

    var query = btoa(b64EncodeUnicode(JSON.stringify({
        url: URI.spec,
        match: (match == null) ? stringBundle.GetStringFromName("internetBlockEnabled") : (preferences.blacklist.advanced_showDetails) ? match : "",
        msg: (preferences.blacklist.advanced_customWarning) ? preferences.blacklist.advanced_customWarningMsg : stringBundle.GetStringFromName("unavailablePage")
    })));

    return contentPath + "blocked.xhtml?" + query;
}

function addFrameContent (global) {
    var shutdownFn;
    // var id = global.sendSyncMessage(host + "getScriptId")[0];

    var loads = function (e) {
        if (global.content.document.location !== e.target.location) {
            return;
        }

        // returns function to disconnect the observers
        shutdownFn = scanContent(e);
    }; 

    var shutdown = function (e) {
        // workaround http://bugzil.la/1202125
        // non-essential since the timer in bootstraps' startup
        // if (typeof id !== "undefined" && e.data && e.data.id !== id) {
        //     return;
        // }

        if (typeof shutdownFn === "function") {
            shutdownFn();
        }

        global.removeEventListener("unload", shutdown, false);
        global.removeMessageListener(host + "unload", shutdown);
        global.removeEventListener("DOMContentLoaded", loads, false);
    };

    global.addEventListener("unload", shutdown, false);
    global.addMessageListener(host + "unload", shutdown);
    global.addEventListener("DOMContentLoaded", loads, false);
}

function addFrameAddress (global) {
    var scan = function (msg) {
        global.removeMessageListener(host + "scan", scan);
        var newURL = scanURL(msg.data.url);
        if (newURL && global.sendSyncMessage(host + "results", {block: true})[0]) {
            global.content.document.location.replace(newURL);
        }
    };

    global.addMessageListener(host + "scan", scan);
}
