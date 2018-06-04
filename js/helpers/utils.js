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
define(["dojo/dom", "dojo/Deferred", "dojo/request", "dojo/_base/array"], 
	function(dom, Deferred, request, array){
	"use strict";

	function AsyncRunner(interval){
		this.interval = interval;
	}
	AsyncRunner.prototype.runSeries = function(collection, worker, done){
		var count = 0;
		var interval = this.interval;

		var process = function(){
			if (count < collection.length){
				setTimeout(function(){
					worker(collection[count]);
					count++;
					process();
				}, interval);
			}else{
				done();
			}
		};
		process();
	};


	return {
		//Recursively mix the properties of two objects 
		mixinDeep: function(dest, source) { 
			var empty = {}; 
			for (var name in source) { 
				if(!(name in dest) || (dest[name] !== source[name] && (!(name in empty) || empty[name] !== source[name]))){ 
					try { 
						if ( source[name].constructor==Object ) { 
							dest[name] = this.mixinDeep(dest[name], source[name]); 
						} else { 
							dest[name] = source[name]; 
						}
					} catch(e) { 
						// Property in destination object not set. Create it and set its value. 
						dest[name] = source[name]; 
					}
				}
			} 
			return dest; 
		},

		removeParents: function(obj){
			if (obj.__parent !== undefined){
				delete(obj.__parent);
			}

			var type = Object.prototype.toString.call(obj);
			
			if (type === "[object Array]" || type === "[object Object]"){
				for (var name in obj){
					this.removeParents(obj[name]);
				}
			}
		},

		// Makes sure that prop is an array
		// if it isn't, it wraps the object into an array with a single element
		// @param scope object to use to resolve prop
		// @param prop string indicating the path to reach the object
		//			ex. "widget.widgetcontainer.url"
		// if the prop cannot be resolved, nothing happens
		arrayify: function(scope, prop){
			var item = this.get(scope, prop, null);
			if (item !== null){
				// We need access to the parent to change the property
				var parent;
				var parts = prop.split(".");
				var itemName = parts[parts.length - 1];

				if (parts.length >= 2){
					parent = this.get(scope, parts.slice(0, parts.length - 1).join("."));
				}else{
					parent = scope;
				}


				if (Object.prototype.toString.apply(item) !== "[object Array]"){
					parent[itemName] = [item];
				}
			}
		},

		get: function(scope, prop, defaultValue){
			var parts = prop.split(".");
			var current = scope;
			for (var i = 0; i < parts.length; i++){
				if (current[parts[i]] !== undefined && i < parts.length - 1){
					current = current[parts[i]];
				}else if (current[parts[i]] !== undefined && i < parts.length){
					return current[parts[i]];
				}else{
					return defaultValue;
				}
			}	
			return defaultValue;
		},

		hasProp: function(scope, prop){
			var parts = prop.split(".");
			var current = scope;
			for (var i = 0; i < parts.length; i++){
				if (current[parts[i]] !== undefined && i < parts.length - 1){
					current = current[parts[i]];
				}else if (current[parts[i]] !== undefined && i < parts.length){
					return true;
				}else{
					return false;
				}
			}	
			return false;
		},

		memoize: function(f){
			var self = f, cache = {};
			return function( arg ){
			  if(arg in cache) {
				return cache[arg];
			  } else {
				return (cache[arg] = self( arg ));
			  }
			};
		},

		stringify: function(obj, replacer, spaces, cycleReplacer) {
			function serializer(replacer, cycleReplacer) {
				var stack = [], keys = [];

				if (cycleReplacer == null) cycleReplacer = function(key, value) {
					if (stack[0] === value) return "[Circular ~]";
					return "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]";
				};

				return function(key, value) {
					if (stack.length > 0) {
					  var thisPos = stack.indexOf(this);
					  ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
					  ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
					  if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value);
					}
					else stack.push(value);

					return replacer == null ? value : replacer.call(this, key, value);
				};
			}

			return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces);
		},

		stripTags: function(str){
			return str.replace(/<[^>]*>/g, "");
		},

		// Hack to force a repaint on a domNode
		redrawDom: function(node){
			node.style.display = 'none';
			node.offsetHeight; // no need to store this anywhere, the reference is enough
			node.style.display = '';
		},

		getPlatform: function(){
			if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) return "iOS";
			else if (/Android/i.test(navigator.userAgent)) return "Android";
			else return "other";
		},

		fireEvent: function(element, eventName){
			if ("createEvent" in document) {
				var evt = document.createEvent("HTMLEvents");
				evt.initEvent(eventName, false, true);
				element.dispatchEvent(evt);
			}else{
				element.fireEvent(eventName);
			}
		},

		// http://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-in-javascript
		round: function(n, decimals){
			return +parseFloat(n + "").toFixed(decimals);
		},

		// http://stackoverflow.com/questions/6784894/add-commas-or-spaces-to-group-every-three-digits
		commafy: function(num) {
		    var str = num.toString().split('.');
		    if (str[0].length >= 5) str[0] = str[0].replace(/(\d)(?=(\d{3})+$)/g, '$1,');
		    if (str[1] && str[1].length >= 5) str[1] = str[1].replace(/(\d{3})/g, '$1 ');
		    return str.join('.');
		},

		cssSafe: function(className){
			return className.replace(/[^\w]/gi, '');
		},

		// Attempts to get a reference to a DOM element by ID
		// this is useful in cases when we expect an element to be created
		// soon, but not right now. Use sparingly.
		onDomElementCreated: function(id, callback, retryAfter){
			retryAfter = retryAfter || 1;

			var el = dom.byId(id);
			var self = this;

			if (el){
				callback(el);
			}else if (retryAfter < 250){
				setTimeout(function(){
					self.onDomElementCreated(id, callback, retryAfter * 2);
				}, retryAfter);
			}else{
				console.warn("Could not find #" + id + " (timeout)");
			}
		},

		AsyncRunner: AsyncRunner,

		preloadImages: function(images){
			for (var i = 0; i < images.length; i++){
				(new Image()).src = images[i];
			}
		},
		
		// Convert date format from xml config to format compatible 
		// with Dojo's API
		convertDateFormat: function(xmlFormat){
			switch(xmlFormat){
				case "shortDate":
					return "MM/dd/yyyy";
				case "D MMM YYYY":
					return "EEEE, MMMM dd yyyy";
				case "MM/DD/YYYY":
					return "MM/dd/yyyy";
				case "M/D/YYYY":
					return "MM/dd/yyyy";
				case "YYYY-MM-DD L:NN A":
					return "yyyy-MM-dd hh:mm a";
				default:
					console.warn("Unrecognized date format: " + xmlFormat);
					return "MM/dd/yyyy";
			}
		},

		File:{
			getExtension: function(file){
				return file.indexOf( '.' ) !== -1 ? 
					file.replace(/.*[.]/, '' ) : 
					'';
			},
			getFilename: function(path){
				path.replace(/.*(\/|\\)/, '');
			}
		},

		// http://stackoverflow.com/questions/3485365/how-can-i-force-webkit-to-redraw-repaint-to-propagate-style-changes
		redraw: function(element){
			element.style.display='none';
			element.offsetHeight; // no need to store this anywhere, the reference is enough
			element.style.display='';
		},

		getQueryParams: function(){
			var params = {};
			var paramsRaw = (window.location.search.replace("?", "").match(/([^&=]+)=?([^&]*)/g) || []);
			for (var i in paramsRaw){
				var parts = paramsRaw[i].split("=");
				params[parts[0]] = parts[1];
			}
			return params;
		},

		loadMultipleJsonFiles: function(files){
			var deferred = new Deferred();
			var output = {};
			var count = 0;

			var onFileLoaded = function(file, json){
				output[file] = json;
				if (++count == files.length) deferred.resolve(output);
			};

			array.forEach(files, function(file){
				request.get(file, {
					handleAs: "json"
				}).then(function(json){
					onFileLoaded(file, json);
				}, deferred.reject);
			});

			if (files.length === 0) deferred.resolve(output);
			return deferred;
		},

		removeDuplicates: function(list){
			if (Object.prototype.toString.apply(list) !== "[object Array]") return [];

			var seen = {};
			return array.filter(list, function(item) {
				return seen.hasOwnProperty(item) ? false : (seen[item] = true);
			});
		},

		stringEndsWith: function(str, needle){
			return str.indexOf(needle) === str.length - needle.length;
		},

		// http://stackoverflow.com/questions/295566/sanitize-rewrite-html-on-the-client-side
		removeTags: function(html){
			var tagBody = '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';

			var tagOrComment = new RegExp(
				'<(?:'
				// Comment body.
				+ '!--(?:(?:-*[^->])*--+|-?)'
				// Special "raw text" elements whose content should be elided.
				+ '|script\\b' + tagBody + '>[\\s\\S]*?</script\\s*'
				+ '|style\\b' + tagBody + '>[\\s\\S]*?</style\\s*'
				// Regular name
				+ '|/?[a-z]'
				+ tagBody
				+ ')>',
				'gi');
			var oldHtml;
			do {
				oldHtml = html;
				html = html.replace(tagOrComment, '');
			} while (html !== oldHtml);
			return html.replace(/</g, '&lt;');
		},

		guid: function(){
		  function s4() {
			return Math.floor((1 + Math.random()) * 0x10000)
			  .toString(16)
			  .substring(1);
		  }
		  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
			s4() + '-' + s4() + s4() + s4();
		},

		hashCode: function(str){
			var hash = 0, i, chr, len;
			if (!str || str.length === 0) return hash;
			for (i = 0, len = str.length; i < len; i++) {
				chr = str.charCodeAt(i);
				hash = ((hash << 5) - hash) + chr;
				hash |= 0; // Convert to 32bit integer
			}
			return hash;
		},

		// Replace one or more object's functions with function that calls
		// the original functions, followed by a callback
		// This is used to patch some of ESRI's code
		intercept: function(obj, funcs, cb){
			if (typeof funcs === 'string') funcs = [funcs];

			function hook(func){
				var orig = obj.prototype[func];
				obj.prototype[func] = function(){
					var self = this;
					var self_args = arguments; 
					
					cb.call(this, function(){
						orig.apply(self, self_args);
					}, self_args);
				};
			}

			for (var i in funcs){
				hook(funcs[i]);
			}
		}
	};
});