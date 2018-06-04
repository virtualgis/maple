/* Maple - A Modern Web Mapping Application
* 
* Copyright (C) 2018 VirtualGIS
* 
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
* 
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
* 
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>. */
define(["dojo/dom", "dojo/dom-construct", "dojo/request", "dojo/dom-class", "dojo/on", "dojo/topic"], 
	function(dom, domConstructor, request, domClass, on, topic){
	"use strict";

	// Decode ESRI's mess to catch connection errors
	// This may not be exaustive, but should work for lots of scenarios.
	topic.subscribe("esri.Error", function(err){
		if (Object.prototype.toString.call(err) === "[object Array]") err = err[0];

		if (err.message){
			// TODO: what to do with token required and unable to complete operation?
			//	these are errors related to misconfiguration or bad permissions.
			if (err.message !== "Token Required" &&
				err.message !== "Unable to complete operation." &&
				err.message !== "Failed to execute query."){
				topic.publish("connectionError", err);
			}
		}
	});

	function showCrashWindow(title, message){
		if (!dom.byId("errorWindow")){
			var win = domConstructor.create("div", {id: "errorWindow"}, "body");
			domConstructor.create("div", {
				'class': "container", 
				innerHTML: "<h1>" + title + "</h1>" + 
					message + "<br/><br/>" +
					"<div style='text-align: center'><button onclick='javascript:location.reload(true);'>Reload the app</button></div><br/>"
			}, win);
		}
	}

	var dieCallback;
    function die(error, rethrow){
    	if (dieCallback) dieCallback(error, rethrow);
    	else{
    		// Normal course of action
	    	console.log(error);
	    	showReportWindow(error);
			if (rethrow) throw new Error(error);
    	}
	}

    // Setup error handling
    on(require, 'error', function (e) {
    	die(e + ": " + JSON.stringify(e));
    });

   
    // Override console.error
    console.error  = function(err, stack){
    	if (err.message){
    		// Catch invalid Token error
	    	if (err.message.indexOf("Invalid Token") === 0){
	    		topic.publish("authentication", "InvalidToken");
	    		return;
	    	}

	    	// Ignore deferred has already been resolved error
	    	if (err.message.indexOf("This deferred has already") === 0){
	    		return;
	    	}

	    	// Bad connection
	    	if (err.message.indexOf("Layer failed to load") !== -1){
	    		topic.publish("esri.Error", err);
	    		return;
	    	}
    	}

    	// Catch cancelErrors which happen on iOS, it just
    	// means that a deferred has been cancelled.
    	if (err.name){
    		if (err.name === "CancelError"){
    			return;
    		}
    	}

    	// Catch loader errors
    	if (err.src){
    		if (err.src === "dojoLoader"){
    			showCrashWindow("Cannot Load Application", "This is probably due to spotty internet or a temporary malfunctioning.<br/><br/>Make sure you are connected to the internet, then reload the app.");
    			return;
    		}
    	}

    	console.log(err, stack);
    };

	return {
		die: die,

		// For catching die calls for testing
		setDieCallback: function(cb){
			dieCallback = cb;
		},
		clearDieCallback: function(){
			dieCallback = undefined;
		}
	};
});