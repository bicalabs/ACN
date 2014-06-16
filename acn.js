// Artificial Cognitive Network

var EventEmitter = require('events').EventEmitter;
var notificationCenter = new EventEmitter();

/*
 * Cogniton class
 */

Cogniton = function (conf, net) {
	var me = this;
	if (!conf.id instanceof String) {
		throw new TypeError('ACN: "id" parameter supplied for cognitor is required and must be a string');
	}
	this.network = net;
	this.id = conf.id;
	this.maxMemLength = conf.maxMemLength ? parseInt(conf.maxMemLength) : 1024;
	if (!conf.cognitor instanceof Function) {
		throw new TypeError('ACN: "cognitor" parameter supplied for cognitor "' + conf.id + '" is required and must be a function');
	}
	this.cognitor = conf.cognitor;
	this.description = conf.description;
	this.eventName = conf.id;
	
	conf.pacemakers = conf.pacemakers || { };
	this.pacemakers = { };
	for (var rate in conf.pacemakers) {
		rate = parseInt(rate);
		if (rate === 0) {
			throw new TypeError('ACN: rate of pacemaker must be an integer greater then 0 (error duting creating cognitor "' + conf.id + '")');
		}
		var fn = conf.pacemakers[rate];
		if (!fn instanceof Function) {
			throw new TypeError('ACN: pacemaker must be a function (error during creating cognitor "' + conf.id + '")');
		}
		this.pacemakers[rate] = function () { fn.apply(me, arguments); };
	}
	conf.inputs = conf.inputs || [ ];
	if (!conf.inputs instanceof Array) {
		throw new TypeError('ACN: inputs must be an array (error duting creating cognitor "' + conf.id + '")');
	}
	for (var el in conf.inputs) {
		if (!el instanceof String) {
			throw new TypeError('ACN: input id "' + el + '" must be a string (error duting creating cognitor "' + conf.id + '")');
		}
	}
	this.inputs = conf.inputs;
	this.mem = { emitted: [ ] };
	this.listeners = [ ];
	for (var el in conf.inputs) {
		var inp = conf.inputs[el];
		this.mem[inp] = [ ];
		this.listeners[inp] = (function () {
			var channel = inp;
			return function (abd, ts) {
				var mem = me.mem[channel];
				me.cognitor.call(me, abd, ts, channel);
				mem.push(abd);
				if (mem.length >= me.maxMemLength)
					mem.shift();
			}
		}) ();
	}

	this.vars = { };
	this.init = conf.init;
	this.initPacemakers = conf.initPacemakers;
}

Cogniton.prototype.memory = function (key, depth) {
	if (!key) key = 'emitted';
	var channel = this.mem[key];
	if (!channel) {
		console.error('ACN: trying to access unexisting memory channel ' + key + ' from cogniton ' + this.id);
		console.log('ACN: existing memory channels are:', this.mem);
		return undefined;
	}
	depth = (depth === undefined || depth === null) ? 0 : depth;
	return channel.slice(depth - 1)[0];
}

Cogniton.prototype.remember = function (key, data) {
	this.vars[key] = data;
}

Cogniton.prototype.recall = function (key) {
	return this.vars[key];
}

Cogniton.prototype.fire = function (data, channel) {
	if (channel) {
		this.mem[channel] = this.mem[channel] || [ ];
	}
	this.cognitor(data, new Date(), channel);
	if (channel) {
		var mem = this.mem[channel];
		mem.push(data);
		if (mem.length >= this.maxMemLength)
			mem.shift();
	}
}

Cogniton.prototype.emit = function (data) {
	var mem = this.mem['emitted'];
	mem.push(data);
	if (mem.length >= this.maxMemLength)
		mem.shift();
	notificationCenter.emit(this.eventName, data);
}

/*
 * Network class
 */

Network = function () {
	this.pacemakers = [ ];
	this.cognitons = [ ];
	this.events = [ ];
}

Network.prototype.add = function (conf) {
	var cogniton = new Cogniton(conf, this);
	if (this.events.indexOf(cogniton.eventName) !== -1) {
		throw new ReferenceError('ACN: can\'t add cogniton "' + conf.id + '" to network since it already has another cogniton with the same id');
	}
	this.cognitons.push(cogniton);
	this.events.push(cogniton.eventName);
	for (var i in cogniton.inputs) {
		var inp = cogniton.inputs[i];
		notificationCenter.on(inp, cogniton.listeners[inp]);
	}
	for (var rate in cogniton.pacemakers) {
		this.pacemakers.push({ rate: parseInt(rate), fn: cogniton.pacemakers[rate] });
	}
}

Network.prototype.on = function (event, handler, scope) {
	notificationCenter.on(event, handler);
}

Network.prototype.run = function () {
	for (var i in this.pacemakers) {
		var pm = this.pacemakers[i];
		setInterval(pm.fn, pm.rate);
	}

	for (var n in this.cognitons) {
		var cogniton = this.cognitons[n];
		if (cogniton.init) {
			cogniton.init.call(cogniton);
		}
		if (cogniton.initPacemakers instanceof Array) {
			for (var el in cogniton.initPacemakers) {
				var pmn = cogniton.initPacemakers[el];
				if (cogniton.pacemakers[pmn]) {
					cogniton.pacemakers[pmn].call(cogniton);
				} else {
					throw new ReferenceError('ACN: cogniton ' + cogniton.id + ' specifies unexisting pacemaker in initPacemakers configuration ' + pcm);
				}
			}
		}
	}
}

exports.Network = Network;
