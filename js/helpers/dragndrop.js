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
define(["dojo/dom-construct", "dojo/dom", "dojo/dom-style", "dojo/dom-attr", "dojo/dom-geometry",
	"dojo/dom-class", "dojo/topic", "maple/helpers/utils", "dojo/_base/array"], 
	function(domConstruct, dom, domStyle, domAttr, domGeom, 
		domClass, topic, utils, array){
	"use strict";

		var addImage = "/images/dragndrop-add.png";
		utils.preloadImages([addImage]);

		function Handler(id){
			var self = this;
			this.node = dom.byId(id);
			this.listeners = [];


			if (!this.node) throw new Error("Invalid element: " + id);

			var indicator = domConstruct.toDom("<div class='dragdropbox'></div>");
    		domConstruct.place(indicator, this.node, "first");

    		var indicatorImage = domConstruct.toDom("<img src='"+ addImage + "' />");
    		domConstruct.place(indicatorImage, indicator, "last");

    		var indicatorLabel = domConstruct.toDom("<div class='supportedFiles'></div>");
    		domConstruct.place(indicatorLabel, indicator, "last");

    		// Allow only files (no text or other data)
			function fileCheck(e){
				if (e.dataTransfer.types) {
					for (var i = 0; i < e.dataTransfer.types.length; i++) {
						if (e.dataTransfer.types[i] == 'Files') {
							return true;
						}
					}
				}
				return false;
			}

			this.node.ondragenter = function(e){
				if (!fileCheck(e)) return false;

				indicatorLabel.innerHTML = array.map(self.listeners, function(listener){
						return listener.title + " " + "(" + 
								listener.extensions.map(function(ext){ return "." + ext; }).join(", ") + 
							")";
					}).join("<br/>");

				domClass.add(this, "onDrag");
				return false;
			};

			this.node.ondragover = function(e) {
				var pos = domGeom.position(indicator);
				domClass.add(this, "onDrag");

				domStyle.set(indicator, 'top', (e.offsetY - pos.h - 100) + 'px');
				domStyle.set(indicator, 'left', (e.offsetX - pos.w / 2)+ 'px');
				return false;
			};

			this.node.ondragend = function() {
				domClass.remove(this, "onDrag");
				return false;
			};

			this.node.ondragleave = function() {
				domClass.remove(this, "onDrag");
				return false;
			};

			this.node.ondrop = function(e) {
				e.preventDefault();
				domClass.remove(this, "onDrag");

				if (!fileCheck(e)) return false;

				function checkOnDrop(listener){
					if (array.indexOf(listener.extensions, ext) !== -1){
						listener.onDrop(array.filter(e.dataTransfer.files, function(file){
							return utils.File.getExtension(file.name).toLowerCase() === ext;
						}), e);
					}
				}
				var checkedExt = {};

				if (e.dataTransfer.files){
					for (var i = 0; i < e.dataTransfer.files.length; i++){
						var ext = utils.File.getExtension(e.dataTransfer.files[i].name).toLowerCase();
						
						// Do not call the listeners for the same extension twice
						if (!checkedExt[ext]){
							array.forEach(self.listeners, checkOnDrop);
							checkedExt[ext] = true;
						}
					}
				}
			};
		}

		Handler.prototype.addListener = function(extensions, title, onDrop) {
			this.listeners.push({
				extensions: extensions,
				title: title,
				onDrop: onDrop
			});
		};

		return {
			Handler: Handler
		};
	}
);