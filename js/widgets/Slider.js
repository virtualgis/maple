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
define("maple/widgets/Slider", [
	"dojo/_base/declare", "dojox/mobile/Slider", "dojo/dom", 
	"dojo/ready", "dojo/_base/lang", "dojo/on", "maple/helpers/utils"], 
	function(declare, dojoxSlider, dom, ready, lang, on, utils) {
		"use strict";

		var postCreate = dojoxSlider.prototype.postCreate;

		return declare("maple/widgets/Slider", [dojoxSlider], {
		   	intermediateChanges: true,
		   	orientation: 'H',
		   	
		   	postCreate: function(){
		   		postCreate.apply(this, arguments);
		   		var self = this;

		   		if (this.hookTo){
			   		ready(function(){
			   			utils.onDomElementCreated(self.hookTo, function(element){
					   		self.hookToNode = element;
					   		if (self.hookToNode){
						   		self.syncFromHook();

						   		on(self.hookToNode, "change", function(){
						   			self.syncFromHook();
						   		});
					   		}
			   			});
			   		});
		   		}
		   	},

		   	syncFromHook: function(){
				this.set('value', this.hookToNode.value);
		   	},

		   	onChange: function(size){
		   		if (this.hookToNode){
			   		var oldValue = this.hookToNode.value;
		   			this.hookToNode.value = size;

		   			if (oldValue != size){
		   				utils.fireEvent(this.hookToNode, "change");
		   			}
		   		}
		   	}
	    });
	}
);