//wrap everything in a function so nothing is in global scope
(function () {
    //pseudo-global variables
    var attrArray = ["Happiness Index", "GRP", "Unemployment Rate (%)", "Life Expectancy", "Crime Rate"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([0, chartHeight])
        .domain([6, 7]);

    //used to order the y axis properly
    var yScaleRev = d3.scaleLinear()
        .range([chartHeight, 0])
        .domain([6, 7]);

    //begin script when window loads
    window.onload = setMap();

    //Example 1.3 line 4...set up choropleth map
    function setMap() {
        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 460;

        //create new svg container for the map
        var map = d3
            .select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on Germany
        var projection = d3
            .geoAlbers()
            .center([8, 51.2])
            .rotate([-2, 0, 0])
            .parallels([43, 62])
            .scale(3000)
            .translate([width / 2, height / 2]);

        var path = d3.geoPath().projection(projection);

        //use Promise.all to parallelize asynchronous data loading
        var promises = [
            d3.csv("data/Germany_Units_Data.csv"),
            d3.json("data/EuropeCountries.topojson"),
            d3.json("data/GermanStates.topojson"),
        ];
        Promise.all(promises).then(callback);

        function callback(data) {
            var csvData = data[0],
                europe = data[1],
                germany = data[2];

            setGraticule(map, path);

            //translate europe TopoJSON
            var europeCountries = topojson.feature(europe, europe.objects.EuropeCountries),
                germanstates = topojson.feature(germany, germany.objects.GermanStates).features;

            //add Europe countries to map
            var countries = map
                .append("path")
                .datum(europeCountries)
                .attr("class", "countries")
                .attr("d", path);

            germanstates = joinData(germanstates, csvData);

            var colorScale = makeColorScale(csvData);

            setEnumerationUnits(germanstates, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            //add dropdown
            createDropdown(csvData);

        }
        var source = "Data Sources: <br> Happiness Index data - www.glueckatlas.de <br> GRP, unemplyment rate and life expectancy data from wikipedia.com <br> Crime rate data - www.statista.com"
        var footer = d3
            .select("body")
            .append("text")
            .attr("class", "footer")
            .html(source);
    }

    function setGraticule(map, path) {
        var graticule = d3.geoGraticule().step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map
            .append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path); //project graticule

        //create graticule lines
        var gratLines = map
            .selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines
    }

    function joinData(germanstates, csvData) {
        //loop through csv to assign each set of csv attribute values to geojson state
        for (var i = 0; i < csvData.length; i++) {
            var csvState = csvData[i]; //the current state
            var csvKey = csvState.id; //the CSV primary key

            //loop through geojson states to find correct state
            for (var a = 0; a < germanstates.length; a++) {
                var geojsonProps = germanstates[a].properties; //the current state geojson properties
                var geojsonKey = geojsonProps.id; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey) {
                    //assign all attributes and values
                    attrArray.forEach(function (attr) {
                        var val = parseFloat(csvState[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                }
            }
        }
        return germanstates;
    }

    function makeColorScale(data) {
        var colorClasses = [
            "#FEF0D9",
            "#FDCC8A",
            "#FC8D59",
            "#E34A33",
            "#B30000"
        ];

        //create color scale generator
        var colorScale = d3.scaleQuantile().range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i = 0; i < data.length; i++) {
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        }

        //assign array of expressed values as scale domain
        colorScale.domain(domainArray);

        return colorScale;
    }

    function setEnumerationUnits(germanstates, map, path, colorScale) {
        //add German states to map
        var states = map
            .selectAll(".states")
            .data(germanstates)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "states " + d.properties.id;
            })
            .attr("d", path)
            .style("fill", function (d) {
                var value = d.properties[expressed];
                if (value) {
                    return colorScale(d.properties[expressed]);
                } else {
                    return "#ccc";
                }
            })
            .on("mouseover", function (event, d) {
                highlight(d.properties);
            })
            .on("mouseout", function (event, d) {
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);

        var desc = states.append("desc").text('{"stroke": "#000", "stroke-width": "0.5px"}');
    }

    //function to create coordinated bar chart
    function setChart(csvData, colorScale) {
        //create a second svg element to hold the bar chart
        var chart = d3
            .select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart
            .append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bars for each province
        var bars = chart
            .selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function (a, b) {
                return b[expressed] - a[expressed];
            })
            .attr("class", function (d) {
                return "bar " + d.id;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .on("mouseover", function (event, d) {
                highlight(d);
            })
            .on("mouseout", function (event, d) {
                dehighlight(d);
            })
            .on("mousemove", moveLabel);

        //create a text element for the chart title
        var chartTitle = chart
            .append("text")
            .attr("x", 40)
            .attr("y", 30)
            .attr("class", "chartTitle");


        //create axis
        var axis = chart.append("g").attr("class", "axis").attr("transform", translate)

        updateChart(bars, csvData.length, colorScale);

        //create frame for chart border
        var chartFrame = chart
            .append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        var desc = bars.append("desc").text('{"stroke": "none", "stroke-width": "0px"}');
    }

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData) {
        //add select element
        var dropdown = d3
            .select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function () {
                changeAttribute(this.value, csvData);
            });

        //add initial option
        var titleOption = dropdown
            .append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown
            .selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function (d) {
                return d;
            })
            .text(function (d) {
                return d;
            });
    }

    //dropdown change listener handler
    function changeAttribute(attribute, csvData) {
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var states = d3
            .selectAll(".states")
            .transition()
            .duration(1000)
            .style("fill", function (d) {
                var value = d.properties[expressed];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            });

        //re-sort, resize, and recolor bars
        var bars = d3
            .selectAll(".bar")
            //re-sort bars
            .sort(function (a, b) {
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function (d, i) {
                return i * 20;
            })
            .duration(500);

        updateChart(bars, csvData.length, colorScale);
    }

    function updateChart(bars, n, colorScale) {

        var chartTitle = ""
        switch (expressed) {
            case "Happiness Index":
                yScale = d3.scaleLinear().range([0, chartHeight]).domain([6, 7]);
                yScaleRev = d3.scaleLinear().range([chartHeight, 0]).domain([6, 7]);
                chartTitle = "Happiness Index in Each State";
                var chartTitle = d3.select(".chartTitle").text(chartTitle).style("padding", "5px");
                break;
            case "GRP":
                yScale = d3.scaleLinear().range([0, chartHeight]).domain([000, 90000]);
                yScaleRev = d3.scaleLinear().range([chartHeight, 0]).domain([0, 90]);
                chartTitle = "GRP in Each State (In Thousand)";
                var chartTitle = d3.select(".chartTitle").text(chartTitle).style("padding", "5px");
                break;
            case "Unemployment Rate (%)":
                yScale = d3.scaleLinear().range([0, chartHeight]).domain([0, 12]);
                yScaleRev = d3.scaleLinear().range([chartHeight, 0]).domain([0, 12]);
                chartTitle = "Unemployment Rate in Each State (%)";
                var chartTitle = d3.select(".chartTitle").text(chartTitle).style("padding", "5px");
                break;
            case "Life Expectancy":
                yScale = d3.scaleLinear().range([0, chartHeight]).domain([79, 82.5]);
                yScaleRev = d3.scaleLinear().range([chartHeight, 0]).domain([79, 82.5]);
                chartTitle = "Life Expectancy in Each State";
                var chartTitle = d3.select(".chartTitle").text(chartTitle).style("padding", "5px");
                break;
            case "Crime Rate":
                yScale = d3.scaleLinear().range([0, chartHeight]).domain([000, 15000]);
                yScaleRev = d3.scaleLinear().range([chartHeight, 0]).domain([0, 15]);
                chartTitle = "Crime Rate in Each State (In Thousand)";
                var chartTitle = d3.select(".chartTitle").text(chartTitle).style("padding", "5px");
        }

        //create vertical axis generator
        var yAxis = d3.axisLeft().scale(yScaleRev);
        //place updated axis
        var axis = d3.select(".axis").call(yAxis);

        //position bars
        bars.attr("x", function (d, i) {
            return i * (chartInnerWidth / n) + leftPadding;
        })
            //size/resize bars
            .attr("height", function (d, i) {
                return yScale(parseFloat(d[expressed]));
            })
            .attr("y", function (d, i) {
                return chartHeight - yScale(parseFloat(d[expressed])) - topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function (d) {
                var value = d[expressed];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            });

        //at the bottom of updateChart()...add text to chart title
        /* var chartTitle = d3
            .select(".chartTitle")
            .text(chartTitle); */
    }


    //function to highlight enumeration units and bars
    function highlight(props) {
        //change stroke
        var selected = d3
            .selectAll("." + props.id)
            .style("stroke", "blue")
            .style("stroke-width", "2");
        setLabel(props);
    }

    //function to reset the element style on mouseout
    function dehighlight(props) {
        var selected = d3
            .selectAll("." + props.id)
            .style("stroke", function () {
                return getStyle(this, "stroke");
            })
            .style("stroke-width", function () {
                return getStyle(this, "stroke-width");
            });

        function getStyle(element, styleName) {
            var styleText = d3.select(element).select("desc").text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        }
        //remove info label
        d3.select(".infolabel").remove();
    }

    //function to create dynamic label
    function setLabel(props) {
        //label content
        var labelAttribute = expressed + ": <b>" + props[expressed] + "</b>";

        //create info label div
        var infolabel = d3
            .select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.id + "_label")
            .html(props.name);

        var stateName = infolabel.append("div").attr("class", "labelname").html(labelAttribute);

    }

    //function to move info label with mouse
    function moveLabel() {
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = event.clientX + 10,
            y1 = event.clientY - 75,
            x2 = event.clientX - labelWidth - 10,
            y2 = event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
        //vertical label coordinate, testing for overflow
        var y = event.clientY < 75 ? y2 : y1;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    }
})();