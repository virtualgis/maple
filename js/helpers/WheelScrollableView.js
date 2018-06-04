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
define([
	"dojo/_base/declare",
	"dojo/has",
	"dojo/on",
	"dojox/mobile/ScrollableView"
], function(declare, has, on, ScrollableView){
	return declare([ScrollableView], {
		init: function(params){
			var self = this;

			this.inherited(arguments);
			if(!has("touch")){
				var handleWheel = function(e){
					e.stopPropagation();

					var pos = self.getPos();
					var dim = self.getDim();
					var deltaY = (e.deltaY ? -e.deltaY : e.wheelDelta) > 0 ? 40 : -40;
					var newY = pos.y + deltaY;
					if (newY <= 0 && Math.abs(newY) <= dim.o.h + 40){ // stop scrolling at the top/bottom
						self.scrollTo({x: pos.x, y: newY});
					}
				};

				on(this.domNode, "wheel", handleWheel);
			}
		}
	});
});