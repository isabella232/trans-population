// NPM modules
var d3 = require('d3');
var request = require('d3-request');

// Local modules
var features = require('./detectFeatures')();
var fm = require('./fm');
var utils = require('./utils');

// Globals
var DEFAULT_WIDTH = 940;
var MOBILE_BREAKPOINT = 600;

var graphicData = null;
var isMobile = false;

/**
 * Initialize the graphic.
 *
 * Fetch data, format data, cache HTML references, etc.
 */
function init() {
	request.csv('data/data.csv', function(error, data) {
		graphicData = formatData(data);

		render();
		$(window).resize(utils.throttle(onResize, 250));
	});
}

/**
 * Format data or generate any derived variables.
 */
function formatData(data) {
	data.forEach(function(d) {
		d['pct'] = parseFloat(d['pct'].replace('%', ''));
	});

	return data;
}

/**
 * Invoke on resize. By default simply rerenders the graphic.
 */
function onResize() {
	render();
}

/**
 * Figure out the current frame size and render the graphic.
 */
function render() {
	var width = $('#interactive-content').width();

	if (width <= MOBILE_BREAKPOINT) {
		isMobile = true;
	} else {
		isMobile = false;
	}

	renderBarChart({
		container: '#graphic',
		width: width,
		data: graphicData
	});

	// Inform parent frame of new height
	fm.resize()
}

/*
 * Render a bar chart.
 */
var renderBarChart = function(config) {
	/*
	 * Setup
	 */
	var labelColumn = 'state';
	var valueColumn = 'pct';

	var barHeight = 30;
	var barGap = 5;
	var labelWidth = 250;
	var labelMargin = 6;
	var valueGap = 6;

	var margins = {
		top: 10,
		right: 15,
		bottom: 30,
		left: (labelWidth + labelMargin)
	};

	var ticksX = 4;
	var roundTicksFactor = 5;

	// Calculate actual chart dimensions
	var chartWidth = config['width'] - margins['left'] - margins['right'];
	var chartHeight = ((barHeight + barGap) * config['data'].length);

	// Clear existing graphic (for redraw)
	var containerElement = d3.select(config['container']);
	containerElement.html('');

	/*
	 * Create the root SVG element.
	 */
	var chartWrapper = containerElement.append('div')
		.attr('class', 'graphic-wrapper');

	var chartElement = chartWrapper.append('svg')
		.attr('width', chartWidth + margins['left'] + margins['right'])
		.attr('height', chartHeight + margins['top'] + margins['bottom'])
		.append('g')
		.attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

	/*
	 * Create D3 scale objects.
	 */
	var min = d3.min(config['data'], function(d) {
		return Math.floor(d[valueColumn] / roundTicksFactor) * roundTicksFactor;
	});

	if (min > 0) {
		min = 0;
	}

	var max = d3.max(config['data'], function(d) {
		return Math.ceil(d[valueColumn] / roundTicksFactor) * roundTicksFactor;
	})

	var xScale = d3.scale.linear()
		.domain([min, max])
		.range([0, chartWidth]);

	/*
	 * Create D3 axes.
	 */
	var xAxis = d3.svg.axis()
		.scale(xScale)
		.orient('bottom')
		.ticks(ticksX)
		.tickSize(-chartHeight, 0)
		.tickFormat(function(d) {
			return d.toFixed(0) + '%';
		});

	/*
	 * Render axes to chart.
	 */
	chartElement.append('g')
		.attr('class', 'x axis')
		.attr('transform', makeTranslate(0, chartHeight))
		.call(xAxis);

	/*
	 * Render grid to chart.
	 */
	// var xAxisGrid = function() {
	// 	return xAxis;
	// };
	//
	// chartElement.append('g')
	// 	.attr('class', 'x grid')
	// 	.attr('transform', makeTranslate(0, chartHeight))
	// 	.call(xAxisGrid()
	// 		.tickSize(-chartHeight, 0)
	// 		.tickFormat('')
	// 	);

	/*
	 * Render bars to chart.
	 */
	chartElement.append('g')
		.attr('class', 'bars')
		.selectAll('rect')
		.data(config['data'])
		.enter()
		.append('rect')
			.attr('x', function(d) {
				if (d[valueColumn] >= 0) {
					return xScale(0);
				}

				return xScale(d[valueColumn]);
			})
			.attr('width', function(d) {
				return Math.abs(xScale(0) - xScale(d[valueColumn]));
			})
			.attr('y', function(d, i) {
				return i * (barHeight + barGap);
			})
			.attr('height', barHeight)
			.attr('class', function(d, i) {
				return 'bar-' + i + ' ' + classify(d[labelColumn]);
			});

	/*
	 * Render 0-line.
	 */
	if (min < 0) {
		chartElement.append('line')
			.attr('class', 'zero')
			.attr('x1', xScale(0))
			.attr('x2', xScale(0))
			.attr('y1', 0)
			.attr('y2', chartHeight);
	}

	/*
	 * Render bar labels.
	 */
	chartWrapper.append('ul')
		.attr('class', 'labels')
		.attr('style', formatStyle({
			'width': labelWidth + 'px',
			'top': margins['top'] + 'px',
			'left': '0'
		}))
		.selectAll('li')
		.data(config['data'])
		.enter()
		.append('li')
			.attr('style', function(d, i) {
				return formatStyle({
					'width': labelWidth + 'px',
					'height': barHeight + 'px',
					'left': '0px',
					'top': (i * (barHeight + barGap)) + 'px;'
				});
			})
			.attr('class', function(d) {
				return classify(d[labelColumn]);
			})
			.append('span')
				.text(function(d) {
					return d[labelColumn];
				});

	/*
	 * Render bar values.
	 */
	chartElement.append('g')
		.attr('class', 'value')
		.selectAll('text')
		.data(config['data'])
		.enter()
		.append('text')
			.text(function(d) {
				return d[valueColumn].toFixed(0) + '%';
			})
			.attr('x', function(d) {
				return xScale(d[valueColumn]);
			})
			.attr('y', function(d, i) {
				return i * (barHeight + barGap);
			})
			.attr('dx', function(d) {
				var xStart = xScale(d[valueColumn]);
				var textWidth = this.getComputedTextLength()

				// Negative case
				if (d[valueColumn] < 0) {
					var outsideOffset = -(valueGap + textWidth);

					if (xStart + outsideOffset < 0) {
						d3.select(this).classed('in', true)
						return valueGap;
					} else {
						d3.select(this).classed('out', true)
						return outsideOffset;
					}
				// Positive case
				} else {
					if (xStart + valueGap + textWidth > chartWidth) {
						d3.select(this).classed('in', true)
						return -(valueGap + textWidth);
					} else {
						d3.select(this).classed('out', true)
						return valueGap;
					}
				}
			})
			.attr('dy', (barHeight / 2) + 3)
}

/*
 * Create a SVG tansform for a given translation.
 */
var makeTranslate = function(x, y) {
    var transform = d3.transform();

    transform.translate[0] = x;
    transform.translate[1] = y;

    return transform.toString();
}

/*
 * Convert arbitrary strings to valid css classes.
 * via: https://gist.github.com/mathewbyrne/1280286
 *
 * NOTE: This implementation must be consistent with the Python classify
 * function defined in base_filters.py.
 */
var classify = function(str) {
    return str.toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

/*
 * Convert key/value pairs to a style string.
 */
var formatStyle = function(props) {
    var s = '';

    for (var key in props) {
        s += key + ': ' + props[key].toString() + '; ';
    }

    return s;
}

// Bind on-load handler
$(document).ready(function() {
	init();
});
