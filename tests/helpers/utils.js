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
define(["doh/runner", "tests/conf", "gisView/helpers/utils"], 
  function(doh, conf, utils){

  doh.register("Utils Module",  [
    {
      name: "utils.arrayify()",
      runTest: function(){
        doh.assertTrue(utils.arrayify !== undefined, "Arrayify exists");

        var obj = {
          a: {},
          b: {
            c: {},
            d: [{value: 1}]
          }
        };

        utils.arrayify(obj, "a");
        utils.arrayify(obj, "b.c");
        utils.arrayify(obj, "b.d");
        utils.arrayify(obj, "nonexisting.property");

        doh.assertTrue(Object.prototype.toString.apply(obj.a) === "[object Array]", "Arrayified obj.a");
        doh.assertTrue(Object.prototype.toString.apply(obj.b.c) === "[object Array]", "Arrayified obj.b.c");
        doh.assertTrue(obj.b.d[0].value === 1, "Did not change obj.b.d");
      }
    },
    {
      name: "utils.hasProp()",
      runTest: function(){
        doh.assertTrue(utils.hasProp !== undefined, "hasProp exists");

        var obj = {
          a: {},
          b: {
            c: {}
          }
        };

        doh.assertTrue(utils.hasProp(obj, "a"), "obj.a exists");
        doh.assertTrue(utils.hasProp(obj, "b.c"), "obj.b.c exists");
        doh.assertFalse(utils.hasProp(obj, "b.nonexistent"), "b.nonexistent does not exist");
        doh.assertFalse(utils.hasProp(obj, "nonexistent.nonexistent"), "nonexistent.nonexistent does not exist");
        doh.assertFalse(utils.hasProp(obj, "nonexistent"), "nonexistent does not exist");
        doh.assertFalse(utils.hasProp(obj, ""), "'' does not exist");
      }
    },
    {
      name: "utils.removeDuplicates()",
      runTest: function(){
        doh.assertTrue(utils.removeDuplicates !== undefined, "removeDuplicates exists");

        var list = ["a", "b", "c", "a", "a", "c"];
        var out = utils.removeDuplicates(list);

        doh.assertTrue(out.length === 3, "3 is the expected length");
        doh.assertTrue(out[0] === "a" && out[1] === "b" && out[2] === "c", "out is the expected array");
        doh.assertTrue(utils.removeDuplicates([]).length === 0, "can pass an empty list");
        doh.assertTrue(utils.removeDuplicates(null).length === 0, "can pass a non array parameter (return [])");
      }
    }]
  );
});
