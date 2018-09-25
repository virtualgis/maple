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
define(["dojo/_base/array", "esri/InfoTemplate", "dojo/_base/lang", 
	"dojo/date/locale", "esri/lang", "maple/helpers/utils", "dojo/dom"], 
	function(array, InfoTemplate, lang, locale, esriLang, utils, dom){
	"use strict";

	// Per ESRI's:
	// "Note that custom formatting functions are required 
	// to be globally accessible." :/
	// https://developers.arcgis.com/javascript/jshelp/intro_formatinfowindow.html

	window.DateFormatEx = function(value, key, data, params){
		// http://dojotoolkit.org/reference-guide/1.10/dojo/date/locale/format.html
		if (value){
			// Since we use a heuristic, at times we might have
			// guessed wrong and receive a string
			// (we can only handle timestamps)
			if (typeof value === "number"){
				var date = new Date(value);
				if (params.useUtc) date = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
				return locale.format(date, {
					selector: params.selector,
					datePattern: params.datePattern
				});
			}else{
				// string, or some other data type
				return value;
			}
		}
		else return "";
	};

	function computeDateFormat(dateFormat, useUtc){
		var dfOpts = [
			"selector: 'date'",
			"datePattern:'" + utils.convertDateFormat(dateFormat) + "'",
			"useUtc:" + useUtc
		];
		
		return ":DateFormatEx(" + dfOpts.join(",") + ")";
	}

	function getFieldsFromAttributes(attributes){
		var res = [];

		if (attributes){
			for (var k in attributes){
				if (k !== "OBJECTID"){
					res.push({
						name: k,
						alias: k,
						visible: true
					});
				}
			}
		}

		return res;
	}

	function getNameFromCodedValue(code, codedValues){
		for (var i in codedValues){
			if (codedValues[i].code === code){
				return codedValues[i].name;
			} 
		}
		return null;
	}

    // @param layer graphic's layer
    // @param fields array from config-general.json or popups.json
    //      ex. [{name: "..", alias: ".."}]
    // Changes fields to include a domain key from layer
    function extractDomainCodedValues(layer, fields){
        if (layer && layer.fields){
            array.forEach(layer.fields, function(lf){
                if (lf.domain){
                    for (var i in fields){
                        if (!fields[i].domain && fields[i].name === lf.name){
                            fields[i].domain = lf.domain; // link
                            break;
                        }
                    }
                }
            });
        }
    }

	return {
		// @param title title of the infowindow (either string or "{}" field without leading "$" or "${}" field)
		// @param fields array from config-general.json or popups.json
		// 		ex. [{name: "..", alias: ".."}]
		// @param opts see below
		create: function(title, fields, opts){
			var self = this;

			opts = lang.mixin({
				allVisible: false, // Whether to display all fields and ignore the .visible attribute 
				titleType: "", // What type is the title (used for formatting)
				linkField: "", // This field will have an anchor tag,
				getFieldsFromAttributes: false, // When true, fields are generated dynamically from the attributes instead of relying on fields param
				showAttachments: false,
				showRelatedRecords: false
			}, opts);

			if (title && title.indexOf("{") === 0) title = "$" + title;

			// Handle title formatting
			if (opts.titleType === "esriFieldTypeDate" && title.indexOf("${") === 0){
				title = title.replace(/\}\s*$/, computeDateFormat("shortDate", true) + "}");
			}

			return new InfoTemplate(title, 
				function (graphic){
        			if (opts.getFieldsFromAttributes){
        				fields = getFieldsFromAttributes(graphic.attributes);
        			}

                    extractDomainCodedValues(graphic.getLayer(), fields);

        			// array.map is destructive (could change graphic.attributes)      			
					var content = array.map(fields, function(field){
						// CodedDomainValue translation
						if (field.domain){
							if (graphic.attributes[field.name] !== undefined){
								var code = graphic.attributes[field.name];
								if (field.domain.codedValues){
									var name = getNameFromCodedValue(code, field.domain.codedValues);
									if (name) graphic.attributes[field.name] = name;
								}
							}
						}

						// Link field
						if (field.name === opts.linkField && graphic.attributes[field.name] !== undefined && graphic.attributes[field.name].indexOf("<a") !== 0){
							graphic.attributes[field.name] = '<a target="_blank" href="' + graphic.attributes[field.name] + '">' + graphic.attributes[field.name] + '</a>';
						}

						if (opts.allVisible || field.visible){
							var computedField = field.name;

							// For fields not marked as date
							var dateHeuristic = /date/i;

							// Format dates (specific to search widget fields)
							if (field.dateformat){
								computedField += computeDateFormat(field.dateformat, field.useutc === true);
							}

							// Format instructions (specific to popups)
							else if (field.format){
								var nfOpts = [];

								if (field.format.precision !== undefined && field.format.precision !== -1){
									nfOpts.push('places:' + field.format.precision);
									if (field.format.usethousandsseparator) nfOpts.push("pattern:'#,##0.##'");
								}
							
								// Give priority to number format in case of ambiguity
								if (nfOpts.length > 0) computedField += ":NumberFormat(" + nfOpts.join(",") + ")";
								else if (field.format.dateformat) computedField += computeDateFormat(field.format.dateformat, field.format.useutc);
								else if (dateHeuristic.test(field.name)) computedField += computeDateFormat("shortDate", true);
							}

							// If we have type information (explicitly extracted via infoTemplate.extractTypeFields())
							else if (field.type === "esriFieldTypeDate"){
								computedField += computeDateFormat("shortDate", true);
							}

							// No explicit format? Check heuristic.
							else if (field.type === undefined && dateHeuristic.test(field.name)) computedField += computeDateFormat("shortDate", true);

                            var fieldTitle = "";

							// Check that alias terminates with ":"
                            var alias = field.alias;
                            if (alias){
                                if (alias.lastIndexOf(":") !== alias.length - 1){
                                    alias = alias + ":";
                                }
                                fieldTitle = alias;
                            }else{
                                // No alias
                                fieldTitle = field.name;
                            }

							return self.getFieldHtml(fieldTitle, "${" + computedField + "}");
						}else{
							return "";
						}
					}).join("");

					var layer = graphic.getLayer();

					if (layer.hasAttachments && layer.objectIdField && graphic.attributes && opts.showAttachments){
						var objectId = graphic.attributes[layer.objectIdField];
						var attachments = self.getDynamicHtmlNode("<div class='attachments'><img class='spinner' src='/images/spinner.gif'/></div>");

						layer.queryAttachmentInfos(objectId, function(files){
							var output = "";
							if (files.length > 0){
								output = "<div class='attachments'>";

								array.forEach(files, function(file){
									var ext = self.getExtensionFromFilename(file.name),
										thumbnail = "";

									if (["jpeg", "jpg", "png", "gif"].indexOf(ext) !== -1){
										var thumbNode = self.getDynamicHtmlNode('<img class="thumbnail" src="/images/spinner.gif" title="' + file.name + '"/>'),
											thumbUrl = "/server/thumbnail.php?u=" + file.url;
										
										thumbnail = thumbNode.getHtml();

										// Load thumbnail
										var img = new Image();
										img.onload = function(){
											thumbNode.setContent('<img class="thumbnail" src="' + thumbUrl + '" title="' + file.name + '"/>');
										};
										img.src = thumbUrl;
									}else{
										thumbnail = "<img class='attachmentIcon' src='" + self.getIconForFilename(file.name) + "'/>";
									}

									var linkAttr = "href='" + file.url + "' target='_blank'";
									output += "<div class='attachment'>" + 
												"<a " + linkAttr + ">" +
													thumbnail +
												"</a> " +
												"<a " + linkAttr + ">" +
													file.name + " (" + self.bytesToHumanDescription(file.size) + ")" +
												"</a>" +
											"</div>";
								});

								output += "</div>";
							}

							attachments.setContent(output);
						}, function(err){
							attachments.setContent("Error while retrieving attachments: ", JSON.stringify(err));
						});

						content += attachments.getHtml();
					}

	                return esriLang.substitute(graphic.attributes, content, {
	                    dateFormat: layer._getDateOpts && layer._getDateOpts.call(layer)
	                });
				}
			);
		},

		getFieldHtml: function(title, content){
			return "<div class='infoField'><b>" + title + "</b>" +
									" " + content + "</div>";
		},

		getDynamicFieldHtml: function(title, content){
			var id = utils.guid() + "-" + title.replace(/[^\w]+/g, "");
			var container;

			return {
				getField: function(formatCb){
					if (formatCb){
						return formatCb(id, title, content);
					}else{
						return "<div class='infoField'><b>" + title + "</b>" +
										" <span id='" + id + "'>" + content + "</span></div>";
					}
				},

				setContent: function(content){
					if (!container) container = dojo.byId(id);

					if (container){
						container.innerHTML = content;
					}
				}
			};
		},

		getDynamicHtmlNode: function(content){
			var id = utils.guid() + "-dynamic-html-node";
			var container;

			return {
				getHtml: function(){
					return "<div id='" + id + "'>" + content + "</div>";
				},

				setContent: function(content){
					if (!container) container = dojo.byId(id);

					if (container){
						container.innerHTML = content;
					}
				}
			};
		},

		getExtensionFromFilename: function(filename){
			return filename.substr(filename.lastIndexOf('.') + 1)
						.toLowerCase()
						.replace(/[^\w\d]+/g, "");
		},

		getIconForFilename: function(filename){
			var ext = this.getExtensionFromFilename(filename);
			var supportedExts = ["7z","class","enc","jpeg","odg","ppt","sql","video","ai","conf","file","jpg","odi","ps","swf","vsd","aiff","cpp","gif","js","odp","py","sxc","wav","asc","cs","gz","lua","ods","ram","sxd","wma","audio","css","hlp","m","odt","rar","sxi","wmv","bin","csv","htm","mm","ogg","rb","sxw","xls","bz2","deb","html","mov","pdf","tar","xml","c","divx","image","mp3","pgp","rm","tex","xpi","cfc","doc","iso","mpg","php","rpm","tgz","xvid","cfm","dot","jar","odc","pl","rtf","txt","zip","chm","eml","java","odf","png","sig","vcf"];
			var icon = "file";
			if (supportedExts.indexOf(ext) !== -1) icon = ext;

			return "/images/fileicons/" + icon + ".png";
		},

		// Converts a number of bytes into a human friendly format for reading
		bytesToHumanDescription: function(bytes){
			if (bytes >= 1024 * 1024) return utils.round(bytes/1024/1024, 2) + " MB";
			else if (bytes >= 1024) return utils.round(bytes/1024, 0) + " KB";
			else return bytes + " Bytes";
		},

		// Extracts information from the layer
		// and place it into the destination fields object
		// This is done to overcome a limitation of ESRI's 
		// platform which for some reason, does not handle types
		// by default and does not include codedvaluedomains, etc.
		extractFieldsInfo: function(dstFields, layer){
			this._setupJsonStructFor(layer);

			var dict = {};
			if (layer.json.fields && layer.json.fields.length){
				for (var i = 0; i < layer.json.fields.length; i++){
					dict[layer.json.fields[i].name] = {
						type: layer.json.fields[i].type,
						domain: layer.json.fields[i].domain
					};
				}

				array.forEach(dstFields, function(dstField){
					if (dict[dstField.name]){
						dstField.type = dict[dstField.name].type;
						dstField.domain = dict[dstField.name].domain;
					}
				});
			}
		},

		getFieldType: function(field, layer){
			this._setupJsonStructFor(layer);
			if (layer.json.fields && layer.json.fields.length){
				for (var i = 0; i < layer.json.fields.length; i++){
					if (layer.json.fields[i].name === field){
						return layer.json.fields[i].type;
					}
				}
			}
			return "";
		},

		_setupJsonStructFor: function(layer){
			if (!layer._json) return;
			if (!layer.json) layer.json = JSON.parse(layer._json);
		}
	};
});