/*!
 * Searchable Map Template with Google Fusion Tables
 * http://derekeder.com/searchable_map_template/
 *
 * Copyright 2012, Derek Eder
 * Licensed under the MIT license.
 * https://github.com/derekeder/FusionTable-Map-Template/wiki/License
 *
 * Date: 12/10/2012
 * 
 */
 
var MapsLib = MapsLib || {};
var MapsLib = {
  
  //Setup section - put your Fusion Table details here
  //Using the v1 Fusion Tables API. See https://developers.google.com/fusiontables/docs/v1/migration_guide for more info
  
  //the encrypted Table ID of your Fusion Table (found under File => About)
  //NOTE: numeric IDs will be depricated soon
  fusionTableId:      "1zaVRv2tjSA8F4kPs83QQh5mFBIM81OobQXrw2u4",  
  
  //*New Fusion Tables Requirement* API key. found at https://code.google.com/apis/console/   
  //*Important* this key is for demonstration purposes. please register your own.   
  googleApiKey:       "AIzaSyBZmv4Q6UbEd83q1GXlm6su2tMpwa18yrQ",        
  
  //name of the location column in your Fusion Table. 
  //NOTE: if your location column name has spaces in it, surround it with single quotes 
  //example: locationColumn:     "'my location'",
  locationColumn:     "location",  

  map_centroid:       new google.maps.LatLng(41.8781136, -87.66677856445312), //center that your map defaults to
  locationScope:      "chicago",      //geographical area appended to all address searches
  recordName:         "result",       //for showing number of results
  recordNamePlural:   "results", 
  
  searchRadius:       805,            //in meters ~ 1/2 mile
  defaultZoom:        11,             //zoom level when map is loaded (bigger is more zoomed in)
  addrMarkerImage: 'http://derekeder.com/images/icons/blue-pushpin.png',
  currentPinpoint: null,
  
  initialize: function() {
    $( "#result_count" ).html("");
  
    geocoder = new google.maps.Geocoder();
    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    map = new google.maps.Map($("#map_canvas")[0],myOptions);

    var styles = [
        {
          featureType: 'all',
          elementType: 'all',
          stylers: [
            { saturation: -95 }
          ]
        }
      ];
    map.setOptions({styles: styles});
    
    MapsLib.searchrecords = null;
    
    //reset filters
    $("#search_address").val(MapsLib.convertToPlainString($.address.parameter('address')));
    var loadRadius = MapsLib.convertToPlainString($.address.parameter('radius'));
    if (loadRadius != "") $("#search_radius").val(loadRadius);
    else $("#search_radius").val(MapsLib.searchRadius);
    $(":checkbox").attr("checked", "checked");
    $("#result_count").hide();
    $("#rbType1").attr("checked", "checked");

    if ($.address.parameter('view_mode') != undefined)
      MapsLib.setResultsView($.address.parameter('view_mode'));

    var filter_type = MapsLib.convertToPlainString($.address.parameter('filter_type'));
    $("#filter_type").val(filter_type);
     
    //run the default search
    MapsLib.doSearch();
  },
  
  doSearch: function(location) {
    MapsLib.clearSearch();
    var address = $("#search_address").val();
    MapsLib.searchRadius = $("#search_radius").val();

    var whereClause = MapsLib.locationColumn + " not equal to ''";
    
    //-----custom filters-------

    var type_column = "gradetype";

    var searchType = type_column + " IN (-1,";
    if ( $("#cbType1").is(':checked')) searchType += "1, 2, 3,";
    if ( $("#cbType2").is(':checked')) searchType += "2, 3, 4, 5,";
    if ( $("#cbType3").is(':checked')) searchType += "3, 5, 6,";
    whereClause += " AND " + searchType.slice(0, searchType.length - 1) + ")";



    //location type filter
    if ( $("#filter_type").val() != "") {
      whereClause += " AND filter_type = '" + $("#filter_type").val() + "'";
      $.address.parameter('filter_type', encodeURIComponent($("#filter_type").val()));
    }
    else $.address.parameter('filter_type', '');



    //-------end of custom filters--------
    
    if (address != "") {
      if (address.toLowerCase().indexOf(MapsLib.locationScope) == -1)
        address = address + " " + MapsLib.locationScope;
  
      geocoder.geocode( { 'address': address}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          MapsLib.currentPinpoint = results[0].geometry.location;
          
          $.address.parameter('address', encodeURIComponent(address));
          $.address.parameter('radius', encodeURIComponent(MapsLib.searchRadius));
          map.setCenter(MapsLib.currentPinpoint);
          map.setZoom(14);
          
          MapsLib.addrMarker = new google.maps.Marker({
            position: MapsLib.currentPinpoint, 
            map: map, 
            icon: MapsLib.addrMarkerImage,
            animation: google.maps.Animation.DROP,
            title:address
          });
          
          whereClause += " AND ST_INTERSECTS(" + MapsLib.locationColumn + ", CIRCLE(LATLNG" + MapsLib.currentPinpoint.toString() + "," + MapsLib.searchRadius + "))";
          
          MapsLib.drawSearchRadiusCircle(MapsLib.currentPinpoint);
          MapsLib.submitSearch(whereClause, map, MapsLib.currentPinpoint);
        } 
        else {
          alert("We could not find your address: " + status);
        }
      });
    }
    else { //search without geocoding callback
      MapsLib.submitSearch(whereClause, map);
    }
  },
  
  submitSearch: function(whereClause, map, location) {
    //get using all filters
    MapsLib.searchrecords = new google.maps.FusionTablesLayer({
      query: {
        from:   MapsLib.fusionTableId,
        select: MapsLib.locationColumn,
        where:  whereClause,
        styleId: 2

      }
    });
    MapsLib.searchrecords.setMap(map);
    MapsLib.getCount(whereClause);
    MapsLib.getList(whereClause);
  },
  
  clearSearch: function() {
    if (MapsLib.searchrecords != null)
      MapsLib.searchrecords.setMap(null);
    if (MapsLib.addrMarker != null)
      MapsLib.addrMarker.setMap(null);  
    if (MapsLib.searchRadiusCircle != null)
      MapsLib.searchRadiusCircle.setMap(null);
  },

  setResultsView: function(view_mode) {
    var element = $('#view_mode');
    if (view_mode == undefined)
      view_mode = 'map';

    if (view_mode == 'map') {
      $('#listCanvas').hide();
      $('#map_canvas').show();
      google.maps.event.trigger(map, 'resize');
      map.setCenter(MapsLib.map_centroid);
      MapsLib.doSearch();

      element.html('Show list <i class="icon-list icon-white"></i>');
    }
    else {
      $('#listCanvas').show();
      $('#map_canvas').hide();

      element.html('Show map <i class="icon-map-marker icon-white"></i>');

    }
    return false;
  },
  
  findMe: function() {
    // Try W3C Geolocation (Preferred)
    var foundLocation;
    
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        foundLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
        MapsLib.addrFromLatLng(foundLocation);
      }, null);
    }
    else {
      alert("Sorry, we could not find your location.");
    }
  },
  
  addrFromLatLng: function(latLngPoint) {
    geocoder.geocode({'latLng': latLngPoint}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {
          $('#search_address').val(results[1].formatted_address);
          $('.hint').focus();
          MapsLib.doSearch();
        }
      } else {
        alert("Geocoder failed due to: " + status);
      }
    });
  },
  
  drawSearchRadiusCircle: function(point) {
      var circleOptions = {
        strokeColor: "#4b58a6",
        strokeOpacity: 0.3,
        strokeWeight: 1,
        fillColor: "#4b58a6",
        fillOpacity: 0.05,
        map: map,
        center: point,
        clickable: false,
        zIndex: -1,
        radius: parseInt(MapsLib.searchRadius)
      };
      MapsLib.searchRadiusCircle = new google.maps.Circle(circleOptions);
  },
  
  query: function(selectColumns, whereClause, callback) {
    var queryStr = [];
    queryStr.push("SELECT " + selectColumns);
    queryStr.push(" FROM " + MapsLib.fusionTableId);
    queryStr.push(" WHERE " + whereClause);
  
    var sql = encodeURIComponent(queryStr.join(" "));
    $.ajax({url: "https://www.googleapis.com/fusiontables/v1/query?sql="+sql+"&callback="+callback+"&key="+MapsLib.googleApiKey, dataType: "jsonp"});
  },

  handleError: function(json) {
    if (json["error"] != undefined) {
      var error = json["error"]["errors"]
      console.log("Error in Fusion Table call!");
      for (var row in error) {
        console.log(" Domain: " + error[row]["domain"]);
        console.log(" Reason: " + error[row]["reason"]);
        console.log(" Message: " + error[row]["message"]);
      }
    }
  },
  
  getCount: function(whereClause) {
    var selectColumns = "Count()";
    MapsLib.query(selectColumns, whereClause,"MapsLib.displaySearchCount");
  },
  
  displaySearchCount: function(json) { 
    MapsLib.handleError(json);
    var numRows = 0;
    if (json["rows"] != null)
      numRows = json["rows"][0];
    
    var name = MapsLib.recordNamePlural;
    if (numRows == 1)
    name = MapsLib.recordName;
    $( "#result_count" ).fadeOut(function() {
        $( "#result_count" ).html(MapsLib.addCommas(numRows) + " " + name + " found");
      });
    $( "#result_count" ).fadeIn();
  },
  
getList: function(whereClause) {
  var selectColumns = "'Name of School (Alt)', '2012-13 20th Day Enrollment','School Type', 'Space Utilization Index (CPS)', 'Apples to Apples Space Utilization Index', 'Space Use Status (CPS)', 'Apples to Apples Space Use Status'";
  MapsLib.query(selectColumns, whereClause, "MapsLib.displayList");
},

displayList: function(json) {
  MapsLib.handleError(json);
  var data = json["rows"];
  var template = "";

  var results = $("#resultsList");
  results.hide().empty(); //hide the existing list and empty it out first

  if (data == null) {
    //clear results list
    results.append("<li><span class='lead'>No results found</span></li>");
  }
  else {
    for (var row in data) {
      template = "\
        <div class='row-fluid item-list'>\
          <div class='span12'>\
            <strong>" + data[row][0] + "</strong> " + data[row][2] + "\
            <br />Enrollment: " + data[row][1] + "\
            <br />Space Utilization Index:   <b>CPS:</b> " + data[row][3] + "   <b>A2A:</b> " + data[row][4] + "\
            <br />Space Use Status:   <b>CPS:</b> " + data[row][5] + "   <b>A2A:</b> " + data[row][6] + "\
            <br />\
            <br />\
          </div>\
        </div>"
      results.append(template);
    }
  }
  results.fadeIn();
},

  addCommas: function(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  },
  

  //converts a slug or query string in to readable text
  convertToPlainString: function(text) {
    if (text == undefined) return '';
    return decodeURIComponent(text);
  }
}