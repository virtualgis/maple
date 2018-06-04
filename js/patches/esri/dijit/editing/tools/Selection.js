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
define(["esri/dijit/editing/tools/Selection", 
	"maple/helpers/utils", "dojo/has", 
	"esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol",
	"dojo/_base/Color"], 
	function(Selection, utils, has, SimpleMarkerSymbol, SimpleLineSymbol,
		Color) {
		"use strict";

		// On mobile, make editing points larger
		if (has("touch")){
			utils.intercept(Selection, '_createSymbols', function(original){
				original();

				this._pointSelectionSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 
																	24, 
																	new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 0, 0]), 1), new Color([255, 0, 0, 0.5]));
			});
		}
	}
);
