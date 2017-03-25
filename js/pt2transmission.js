// ==UserScript==
// @name         pt2transmission
// @namespace    https://github.com/coderant/
// @version      0.0.1
// @description  Add a button in some private tracker site to support adding torrent to Transmission. Current support CCF and TTG.
// @supportURL   https://github.com/coderant/pt2transmission
// @updateURL    https://raw.githubusercontent.com/coderant/pt2transmission/master/js/pt2transmission.js
// @author       Muffin_C
// @match        *://ccfbits.org/*
// @match        *://totheglory.im/*
// @require      https://code.jquery.com/jquery-3.2.1.min.js
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// ==/UserScript==

// Edit these before use.
// http://192.168.1.1 for local access, input ddns for external access.
// NO trailing slash(/).
var transmission_url = "http://your.url.here";

// value of "rpc-port" in settings.json .
var transmission_port = "9091";

// value of "rpc-url"  in settings.json .
var transmission_rpc_bind_address = "/transmission/";

// Authentication;
var username = "your_username";
var pw = "your_password";

// DO NOT EDIT BELOW.
var rpc_url = transmission_url + ":" + transmission_port + transmission_rpc_bind_address + "rpc";
console.log("Constructed url:" + rpc_url);

(function () {
    'use strict';
    var site = window.location.href;
    var reCCF = /ccf/i;
    var reTTG = /totheglory/i;
    var baseURL = document.location.origin;
    var target;
    var buttonCSS = {
        'background-color': '#B6B6B6',
        '-moz-border-radius': '2px',
        '-webkit-border-radius': '2px',
        'border-radius': '2px',
        'display': 'inline-block',
        'cursor': 'pointer',
        'color': '#000000',
        'font-family': 'Verdana',
        'font-size': '12px',
        'padding': '2px 5px',
        'text-decoration': 'none'
    };

    if (reCCF.test(site)) {
        if (site.includes("browse")) {
            target = $('table[border=1][cellpadding=5]>>> td:nth-child(2):not([class])');
            target.each(function (i) {
                var pageURL = baseURL + "/" + $(this).find("a[title][href]").attr("href");
                var el = $('<a>', {id: "transmission_main_" + i, rel: pageURL, text: "Transmission"});
                el.css(buttonCSS);
                $(this).append(el);
                el.after($('<a>', {id: "transmission_main_" + i + "_result", text: "", style: "padding-left:5px"}));
            });
        }
        if (site.includes("details")) {
            target = $('a[class="index"][href*=".torrent"]');
            var ccfTorrentUrl = baseURL + "/" + target.attr("href");
            var ccfDetailInsert = $('<a>', {id: "transmission_detail", rel: ccfTorrentUrl, text: "Transmission"});
            ccfDetailInsert.css(buttonCSS);
            target.after(ccfDetailInsert);
            ccfDetailInsert.after($('<a>', {id: "transmission_detail_result", text: "", style: "padding-left:5px"}));
            target.after("<br>");
        }
    }

    if (reTTG.test(site)) {
        if (site.includes("browse")) {
            target = $('tr[id]> td:nth-child(2)');
            target.each(function (i) {
                var page = $(this).find("a[href]").attr("href");
                var el = $('<a>', {id: "transmission_" + i, rel: baseURL + page, text: "Transmission"});
                el.css(buttonCSS);
                $(this).append(el);
                el.after($('<a>', {id: "transmission_" + i + "_result", text: "", style: "padding-left:5px"}));
            });
        }
        if (site.includes("/t/")) {
            target = $('a[class="index"][href*=".zip"]');
            var ttgTorrentUrl = baseURL + "/" + $('a[class="index"][href*=".torrent"]').attr("href");
            var ttgDetailInsert = $('<a>', {id: "transmission_detail", rel: ttgTorrentUrl, text: "Transmission"});
            ttgDetailInsert.css(buttonCSS);
            target.after(ttgDetailInsert);
            ttgDetailInsert.after($('<a>', {id: "transmission_detail_result", text: "", style: "padding-left:5px"}));
            target.after("<br>");
        }
    }

    $('[id^=transmission]:not([id*=result]').click(function () {
        var torrentPage = $(this).attr('rel');
        var id = $(this).attr('id');
        console.log(id + " is clicked");
        if (id.includes("main")) {
            GM_xmlhttpRequest({
                method: "GET",
                url: torrentPage,
                onload: function (response) {
                    // console.log("Start fetching torrent details");
                    var torrentURL = baseURL + "/" + $(response.responseText).find('a[href*=".torrent"]').attr('href');
                    // console.log("Extracted torrent url: " + torrentURL);
                    var request = {
                        arguments: {cookies: getCookie(), filename: torrentURL},
                        method: "torrent-add",
                        tag: 80
                    };
                    console.log("Clicked:" + id);
                    addTorrent($("#" + id), $("#" + id + "_result"), request);
                }
            });
        }
        if (id.includes("detail")) {
            var torrentURL = baseURL + "/" + $('a[class="index"][href*=".torrent"]').attr('href');
            var request = {arguments: {cookies: getCookie(), filename: torrentURL}, method: "torrent-add", tag: 80};
            addTorrent($("#" + id), $("#" + id + "_result"), request);
        }
    });
})();

function addTorrent(button, result, request, sessionId, tries) {
    if (!tries) {
        tries = 0;
    }
    if (tries === 3) {
        alert("p2transmission: Too many Error 409: Conflict.\nCheck your transmission installation");
        return;
    }
    console.log("sending torrent with sessionid: (" + sessionId);
    console.log("sending: " + JSON.stringify(request));
    GM_xmlhttpRequest({
        method: "POST",
        user: username,
        password: pw,
        url: rpc_url,
        data: JSON.stringify(request),
        headers: {
            "X-Transmission-Session-Id": sessionId
        },
        onload: function (response) {
            console.log([
                response.status,
                response.statusText,
                response.responseText
            ].join("\n"));
            var resultText;
            var success = false;
            var unclickable = false;
            var error = false;
            switch (response.status) {
                case 200: // status OK
                    var rpcResponse = response.responseText;
                    var rpcJSON = JSON.parse(rpcResponse);
                    if (rpcJSON.result.toLowerCase() === "success") {
                        if ("torrent-duplicate" in rpcJSON.arguments) {
                            resultText = "Already added: " + rpcJSON['arguments']['torrent-duplicate'].name;
                        } else {
                            resultText = "Added: " + rpcJSON['arguments']['torrent-added'].name;
                        }
                        success = true;
                    } else {
                        resultText = 'ERROR: ' + rpcJSON.result;
                        error = true;
                    }
                    unclickable = true;
                    break;
                case 401:
                    resultText = "Your username/password is not correct.";
                    error = true;
                    break;
                case 409:
                    var headers = response.responseHeaders.split("\n");
                    for (var i in headers) {
                        var header = headers[i].split(":");
                        if (header[0] == "X-Transmission-Session-Id") {
                            sessionId = header[1].trim();
                            console.log("Got new Session ID: (" + sessionId);
                            addTorrent(button, result, request, sessionId, tries + 1);
                        }
                    }
                    break;
                default:
                    resultText = "Unknown Transmission Response";
                    error = true;
                    alert("Unknown Transmission Response: " + response.status + " " + response.statusText);
            }
            console.log(resultText);
            result.text(resultText);
            if (unclickable) {
                button.unbind('click');
                button.css("cursor", "default");
            }
            if (success) {
                button.css("background-color", "#8FFFA6");
            }
            if (error) {
                button.css("background-color", "#FFBAC2");
            }
        }
    });
}

function getCookie() {
    // from https://github.com/bulljit/Transmission-Add-Torrent-Bookmarkelet Thanks guys.
    var sCookie = "";
    var aCookie = document.cookie.split(/;[\s\xA0]*/);
    if (aCookie !== "") {
        for (var i = 0; i < aCookie.length; i++) {
            if (aCookie[i].search(/(^__utm|^__qc)/) == -1) {
                sCookie = sCookie + aCookie[i] + '; ';
            }
        }
    }
    sCookie = sCookie.replace(/;\s+$/, "");
    return sCookie;
}