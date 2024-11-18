//wrap everything in a function so nothing is in global scope
(function () {
    //pseudo-global variables
    var attrArray = ["Happiness Index", "GRP (€)", "Unemployment Rate (%)", "Life Expectancy", "Crime Rate"]; 
    var expressed = null; //initial attribute

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.4,
        chartHeight = 360,
        leftPadding = 20,
        rightPadding = 240,
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

    // Define different color scales for each attribute
    var colorScales = {
        "Happiness Index": d3.scaleQuantile().range(["#EDF8FB", "#B2E2E2", "#66C2A4", "#2CA25F", "#006D2C"]),
        "GRP (€)": d3.scaleQuantile().range(["#EDF8FB", "#B2E2E2", "#66C2A4", "#2CA25F", "#006D2C"]),
        "Unemployment Rate (%)": d3.scaleQuantile().range(["#FEF0D9", "#FDCC8A", "#FC8D59", "#E34A33", "#B30000"]),
        "Life Expectancy": d3.scaleQuantile().range(["#EDF8FB", "#B2E2E2", "#66C2A4", "#2CA25F", "#006D2C"]),
        "Crime Rate": d3.scaleQuantile().range(["#FEF0D9", "#FDCC8A", "#FC8D59", "#E34A33", "#B30000"])
    };

    var textColors = {
        "Happiness Index": "#2CA25F",
        "GRP (€)": "#2CA25F",
        "Unemployment Rate (%)": "#E34A33",
        "Life Expectancy": "#2CA25F",
        "Crime Rate": "#E34A33"
    };

    //begin script when window loads
    window.onload = setMap();

    //Example 1.3 line 4...set up choropleth map
    function setMap() {
        //map frame dimensions
        var width = window.innerWidth * 0.35,
            height = 680;
            

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
            .scale(4200)
            .translate([width / 2 , height / 2]);

        var path = d3.geoPath().projection(projection);

        d3.select(".map")
        .style("margin-left", "240px");

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

            //setGraticule(map, path);

            //translate europe TopoJSON
            //var europeCountries = topojson.feature(europe, europe.objects.EuropeCountries)
            var germanstates = topojson.feature(germany, germany.objects.GermanStates).features;

            //add Europe countries to map
            /*
            var countries = map
                .append("path")
                .datum(europeCountries)
                .attr("class", "countries")
                .attr("d", path);
            */

            germanstates = joinData(germanstates, csvData);

            var colorScale = makeColorScale(csvData);

            setEnumerationUnits(germanstates, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            //add dropdown
            createDropdown(csvData);
            createInfoPanel(expressed);
            createFooter();       
        }

        /*
        var source = "Data Sources: <br> Happiness Index data - www.glueckatlas.de <br> GRP, unemployment rate and life expectancy data from wikipedia.com <br> Crime rate data - www.statista.com";

        // Select the body and append a div for better styling and positioning
        var footer = d3
            .select("body")
            .append("div") // Use a <div> for semantic and styling benefits
            .attr("class", "footer")
            .style("text-align", "center") // Optional styling
            .style("margin-top", "20px") // Optional styling
            .html(source);
        */
            
    }
    
    function createFooter() {
        var footerText = "Data Sources: <br> Happiness Index data - www.glueckatlas.de, GRP, unemployment rate and life expectancy data from wikipedia.com, Crime rate data - www.statista.com";
        
        d3.select("body")
          .append("div")
          .attr("class", "footer")
          .style("text-align", "left")
          .style("margin-top", "0px")
          .style("padding", "120px")
          .style("clear", "both")
          .html(footerText);
    }

    function createInfoPanel(attribute) {
        var infoText = {
            "Happiness Index": "The <em>Happiness Index</em> offers a snapshot of how cheerful and satisfied residents feel across Germany’s states. Scores range from a cozy 6.2 to a sunnier 6.78, with Saxony-Anhalt and Schleswig-Holstein leading the happiness parade! These regions shine thanks to factors like strong social connections, a sense of community, and maybe even a touch of that crisp, refreshing northern air. <br><br>On the flip side, Berlin seems to be having a bit of a gloomy moment, landing at the lower end of the scale. But don’t worry, it’s nothing a little social sparkle and creative problem-solving can’t fix! This visualization is your chance to explore the joy map of Germany and spot opportunities to spread a little extra happiness where it’s needed most.",
            "GRP (€)": "The <em>Gross Regional Domestic Product (GRP)</em> per capita reveals the economic heartbeat of Germany’s states. <br><br>Hamburg sits at the top, boasting a GRP of €66,879, reflecting its thriving industries and global connections. Meanwhile, Saxony-Anhalt, with a GRP of €28,800, highlights a quieter economic pace but no less charm. These figures, expressed in nominal euros for easy comparison, offer a snapshot of economic performance and disparity across the country.",
            "Unemployment Rate (%)": "The <em>Unemployment Rate</em> offers a snapshot of Germany's labor market dynamics. <br><br>In 2020, Bremen faced the highest unemployment rate at 10.2%, reflecting significant challenges in its local economy. On the other hand, Bavaria led the way with the lowest rate at 3.1%, showcasing its strong employment opportunities and thriving industries. <br><br>These figures highlight the diverse economic realities across the German states. If you’re considering working in Germany, these figures can help you identify regions with thriving job markets and areas where opportunities might be harder to come by.",
            "Life Expectancy": "The <em>Life Expectancy</em> dataset reveals how long residents of Germany's states are expected to live, offering insights into regional health and living conditions. <br><br>Baden-Württemberg takes the lead with an impressive life expectancy of 81.88 years, reflecting its high standards of healthcare and quality of life. Meanwhile, Saxony-Anhalt records the lowest at 79.46 years, pointing to areas where public health initiatives might make a difference. These figures paint a fascinating picture of longevity across Germany, highlighting regional disparities in well-being.",
            "Crime Rate": "The <em>Crime Rate</em> dataset provides a glimpse into public safety across Germany's states, measured per 100,000 people. Berlin reports the highest crime rate at 13,330, reflecting the challenges of managing safety in a bustling urban hub. In stark contrast, Bavaria enjoys the lowest rate at 4,291, showcasing its reputation for being one of the safest regions in the country. <br><br>Take a closer look at the map to explore how safety varies across the states and see how your region compares or where you would prefer to be!"
        };
    
        // Get the footer container, create it if it doesn't exist
        var infoPanel = d3.select(".infoPanel");
        if (infoPanel.empty()) {
            infoPanel = d3.select("body")
                .append("div")
                .attr("class", "infoPanel")
                .style("text-align", "left")
                .style("margin-top", "0px")
                .style("padding", "20px")
                .style("clear", "both");
        }
    
        // Update the footer text based on the current attribute
        infoPanel.html(infoText[attribute]);
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

    // Update makeColorScale to use the appropriate scale for the current attribute
    function makeColorScale(data) {
        if (!expressed) {
            // Return a single grey color scale when no attribute is selected
            return d3.scaleQuantile().range(["#ccc"]);
        }
        // Select the appropriate color scale for the expressed attribute
        var colorScale = colorScales[expressed];

        // Build array of all values of the expressed attribute
        var domainArray = [];
        for (var i = 0; i < data.length; i++) {
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        }

        // Assign array of expressed values as scale domain
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
                if (!expressed) {
                    return "#ccc"; // Grey color when no data is selected
                }
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
        // Create the bar chart SVG container
        var chart = d3
            .select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
    
        // Create a background rectangle for the bar chart
        chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
    
        // Create bars
        var bars = chart
            .selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("width", chartInnerWidth / csvData.length - 1)
            .attr("height", 0) // Initially no height
            .attr("y", chartHeight - topBottomPadding) // Bars start at the bottom
            .style("fill", "#ccc") // Grey default color
            .on("mouseover", function (event, d) {
                highlight(d);
            })
            .on("mouseout", function (event, d) {
                dehighlight(d);
            })
            .on("mousemove", moveLabel); // Update label position
    
        // Create a text element for the chart title
        chart.append("text")
            .attr("x", 40)
            .attr("y", 30)
            .attr("class", "chartTitle")
            .text(""); // No title initially
    
        // Add a Y-axis (left)
        var yAxis = d3.axisLeft(yScaleRev);
        chart.append("g")
            .attr("class", "axis y-axis")
            .attr("transform", translate)
            .call(yAxis);
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

    function changeAttribute(attribute, csvData) {
        // Change the expressed attribute
        expressed = attribute;
    
        // Recreate the color scale
        var colorScale = makeColorScale(csvData);
    
        // Recolor enumeration units
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
    
        // Re-sort, resize, and recolor bars
        var bars = d3
            .selectAll(".bar")
            .sort(function (a, b) {
                return b[expressed] - a[expressed];
            })
            .transition()
            .delay(function (d, i) {
                return i * 20;
            })
            .duration(500);
    
        updateChart(bars, csvData.length, colorScale);
    
        // Update the footer text based on the selected attribute
        createInfoPanel(attribute);
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
            case "GRP (€)":
                yScale = d3.scaleLinear().range([0, chartHeight]).domain([000, 90000]);
                yScaleRev = d3.scaleLinear().range([chartHeight, 0]).domain([0, 90]);
                chartTitle = "GRP (€) Per Capita in Each State (in thousand)";
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
                chartTitle = "Crime Rate per 100,000 people (in thousand)";
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

    }


    //function to highlight enumeration units and bars
    function highlight(props) {
        // Highlight the bar and state
        d3.selectAll("." + props.id)
            .style("stroke", "blue")
            .style("stroke-width", "2");
    
        // Set the label with the correct properties
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

    // Update the setLabel function
    function setLabel(props) {
        // Label content
        var labelAttribute = expressed + ": <b>" + props[expressed] + "</b>";

        // Determine the text color based on the expressed attribute
        var textColor = textColors[expressed] || "#000"; // Default to black if not defined

        // Create info label div
        var infolabel = d3
            .select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.id + "_label")
            .html(props.name);

        // Append additional details with colored text
        var stateName = infolabel
            .append("div")
            .attr("class", "labelname")
            .html(labelAttribute)
            .style("color", textColor); // Apply the determined text color
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