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
	var us = [data[0]];
	var rest = data.slice(1);

	rest.sort(function(a, b) {
		if (a['pct'] > b['pct']) {
			return -1;
		}

	    if (a['pct'] < b['pct']) {
			return 1;
		}

		return 0;
	})

	data = us.concat(rest);

	console.log(data);

	data.forEach(function(d) {
		d['pct'] = parseFloat(d['pct'].replace('%', ''));
		d['pct_lower'] = parseFloat(d['pct_lower'].replace('%', ''));
		d['pct_upper'] = parseFloat(d['pct_upper'].replace('%', ''));
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
	var labelWidth = isMobile? 120 : 150;
	var labelMargin = 6;
	var valueGap = 6;
	var intervalHeight = 4;

	var margins = {
		top: 30,
		right: 25,
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
	var xScale = d3.scale.linear()
		.domain([0, 1.5])
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
			if (d == 0) {
				return '0%'
			}

			return d.toFixed(1) + '%';
		});

	/*
	 * Render axes to chart.
	 */
	chartElement.append('g')
		.attr('class', 'x axis')
		.attr('transform', makeTranslate(0, chartHeight))
		.call(xAxis);

	/*
	 * Render intervals to chart.
	 */
	chartElement.append('g')
		.attr('class', 'intervals')
		.selectAll('g')
		.data(config['data'])
		.enter().append('g')
			.attr('class', function(d) {
				return classify(d['state']);
			})
			.each(function(d, i) {
				var r = 3;
				var y = (i * (barHeight + barGap)) + barHeight / 2
				var lower_x = xScale(d['pct_lower']);
				var upper_x = xScale(d['pct_upper']);
				var point_x = xScale(d['pct']);

				d3.select(this).append('line')
					.attr('x1', lower_x)
					.attr('x2', upper_x)
					.attr('y1', y)
					.attr('y2', y)

				d3.select(this).append('line')
					.attr('class', 'lower')
					.attr('x1', lower_x)
					.attr('x2', lower_x)
					.attr('y1', y - intervalHeight)
					.attr('y2', y + intervalHeight);

				d3.select(this).append('line')
					.attr('class', 'upper')
					.attr('x1', upper_x)
					.attr('x2', upper_x)
					.attr('y1', y - intervalHeight)
					.attr('y2', y + intervalHeight);

				d3.select(this).append('circle')
					.attr('class', 'point')
					.attr('r', r)
					.attr('cx', point_x)
					.attr('cy', y);

				d3.select(this).append('text')
					.attr('class', 'point-label')
					.attr('x', point_x)
					.attr('y', y - 6)
					.attr('style', formatStyle({
						'text-anchor': 'middle'
					}))
					.text(d['pct'].toFixed(2) + '%');

				if (d['state'] == 'United States') {
					d3.select(this).append('text')
						.attr('class', 'lower-label')
						.attr('x', lower_x - valueGap)
						.attr('y', y)
						.attr('style', formatStyle({
							'text-anchor': 'end',
							'alignment-baseline': 'middle'
						}))
						.text(d['pct_lower'].toFixed(2) + '%');

					d3.select(this).append('text')
						.attr('class', 'upper-label')
						.attr('x', upper_x + valueGap)
						.attr('y', y)
						.attr('style', formatStyle({
							'alignment-baseline': 'middle'
						}))
						.text(d['pct_upper'].toFixed(2) + '%');
				}
			});

	var annotations = chartElement.append('g')
		.attr('class', 'annotations');

	annotations.append('text')
		.attr('class', 'lower')
		.attr('x', xScale(config['data'][0]['pct_lower']))
		.attr('y', -6)
		.attr('style', formatStyle({
			'text-anchor': 'end'
		}))
		.html('At least')

	annotations.append('text')
		.attr('class', 'upper')
		.attr('x', xScale(config['data'][0]['pct_upper']))
		.attr('y', -6)
		.attr('style', formatStyle({
			'text-anchor': 'start'
		}))
		.html('At most')

	annotations.append('text')
		.attr('class', 'point')
		.attr('x', xScale(config['data'][0]['pct']))
		.attr('y', -6)
		.attr('style', formatStyle({
			'text-anchor': 'middle'
		}))
		.html('Estimate')

	/*
	 * Render labels.
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
