function simulate(data, svg) {
    const width = parseInt(svg.attr("viewBox").split(' ')[2]);
    const height = parseInt(svg.attr("viewBox").split(' ')[3]);

    // Group for zooming
    const zoomableGroup = svg.append("g");

    // Main group for the network
    const mainGroup = zoomableGroup.append("g").attr("transform", "translate(0, 50)");

    // Calculate node degrees
    let nodeDegree = {};
    data.links.forEach(d => {
        nodeDegree[d.source] = (nodeDegree[d.source] || 0) + 1;
        nodeDegree[d.target] = (nodeDegree[d.target] || 0) + 1;
    });

    // Node radius scale based on degree
    const scaleRadius = d3.scaleSqrt()
        .domain(d3.extent(Object.values(nodeDegree)))
        .range([3, 12]);

    // Calculate country counts
    const countryCounts = {};
    data.nodes.forEach(node => {
        const country = node.country;
        if (country) {
            countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
    });

    // Top 10 countries based on count
    const topCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => entry[0]);

    // Custom color palette for countries
    const customColors = [
        "#e41a1c", "#377eb8", "#4daf4a", "#984ea3", 
        "#ff7f00", "#ffbf00", "#a65628", "#f781bf", 
        "#000000", "#66c2a5"
    ];

    const colorScale = d3.scaleOrdinal(customColors).domain(topCountries);

    // Get color by country
    const getColorByCountry = (country) => {
        const index = topCountries.indexOf(country);
        return index !== -1 ? colorScale(index) : "#cccccc";
    };

    // Links
    const linkElements = mainGroup.append("g")
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .selectAll(".line")
        .data(data.links)
        .enter()
        .append("line")
        .attr("stroke", "grey");

    // Nodes
    const nodeElements = mainGroup.append("g")
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .selectAll(".circle")
        .data(data.nodes)
        .enter()
        .append('g')
        .on("mouseover", function(event, d) {
            const affiliation = d.affiliation;
            nodeElements.selectAll("circle")
                .style("opacity", n => n.affiliation === affiliation ? 1 : 0.2);
        })
        .on("mouseout", function() {
            nodeElements.selectAll("circle").style("opacity", 1);
        })
        .on("click", function(event, d) {
            const tooltip = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`
                Author: ${d.id}<br>
                Affiliation: ${d.affiliation}<br>
                Country: ${d.country}<br>
                Publications: ${d.publications}<br>
                Titles: ${d.titles ? d.titles.join("<br>") : "No titles available"}
            `)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");

            setTimeout(() => {
                tooltip.transition().duration(500).style("opacity", 0).remove();
            }, 3000);
        });

    // Add circles for each node
    nodeElements.append("circle")
        .attr("r", d => scaleRadius(nodeDegree[d.id] || 0))
        .attr("fill", d => getColorByCountry(d.country));

    // Drag behavior for nodes
    const drag = d3.drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded);

    nodeElements.call(drag);

    // Force Simulation
    let forceSimulation = d3.forceSimulation(data.nodes)
        .force("collide", d3.forceCollide(d => scaleRadius(nodeDegree[d.id]) * 2))
        .force("x", d3.forceX().strength(0.1))
        .force("y", d3.forceY().strength(0.1))
        .force("charge", d3.forceManyBody().strength(-100).distanceMax(300))
        .force("link", d3.forceLink(data.links).id(d => d.id).distance(50).strength(0.3))
        .on("tick", ticked);

    // Update forces when sliders change
    function updateForces() {
        const chargeStrength = parseInt(document.getElementById("chargeStrength").value);
        const collisionRadius = parseInt(document.getElementById("collisionRadius").value);
        const linkStrength = parseFloat(document.getElementById("linkStrength").value);

        forceSimulation
            .force("charge", d3.forceManyBody().strength(chargeStrength))
            .force("collide", d3.forceCollide().radius(d => scaleRadius(nodeDegree[d.id]) * collisionRadius / 12))
            .force("link", d3.forceLink(data.links).id(d => d.id).strength(linkStrength))
            .alpha(1)
            .restart();

        if (forceTimeout) {
            clearTimeout(forceTimeout);
        }

        forceTimeout = setTimeout(() => {
            forceSimulation.alphaTarget(0);
        }, 3000);
    }

    // Event listeners for slider inputs
    document.getElementById("chargeStrength").addEventListener("input", updateForces);
    document.getElementById("collisionRadius").addEventListener("input", updateForces);
    document.getElementById("linkStrength").addEventListener("input", updateForces);

    // Update node and link positions during simulation ticks
    function ticked() {
        nodeElements.attr('transform', function(d) { return `translate(${d.x},${d.y})`; });
        linkElements
            .attr("x1", d => d.source.x)
            .attr("x2", d => d.target.x)
            .attr("y1", d => d.source.y)
            .attr("y2", d => d.target.y);
    }

    // Drag start behavior
    function dragStarted(event, d) {
        if (!event.active) forceSimulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    // Drag behavior
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    // Drag end behavior
    function dragEnded(event, d) {
        if (!event.active) forceSimulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Zoom functionality
    const zoom = d3.zoom()
        .scaleExtent([0.5, 5])
        .on('zoom', (event) => {
            zoomableGroup.attr('transform', event.transform);
        });

    svg.call(zoom);
}

// Load the data and start the simulation
d3.json("author_network.json").then(data => {
    const svg = d3.select("svg");
    simulate(data, svg);
});
