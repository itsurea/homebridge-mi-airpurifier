require('./Base');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;

MiAirPurifier2 = function(platform, config) {
    this.init(platform, config);
    
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    
    this.device = new miio.Device({
        address: this.config['ip'],
        token: this.config['token']
    });
    
    this.accessories = {};
    if(!this.config['airPurifierDisable'] && this.config['airPurifierName'] && this.config['airPurifierName'] != "" && this.config['silentModeSwitchName'] && this.config['silentModeSwitchName'] != "") {
        this.accessories['airPurifierAccessory'] = new MiAirPurifier2AirPurifierAccessory(this);
    }
    if(!this.config['temperatureDisable'] && this.config['temperatureName'] && this.config['temperatureName'] != "") {
        this.accessories['temperatureAccessory'] = new MiAirPurifier2TemperatureAccessory(this);
    }
    if(!this.config['humidityDisable'] && this.config['humidityName'] && this.config['humidityName'] != "") {
        this.accessories['humidityAccessory'] = new MiAirPurifier2HumidityAccessory(this);
    }
    if(!this.config['buzzerSwitchDisable'] && this.config['buzzerSwitchName'] && this.config['buzzerSwitchName'] != "") {
        this.accessories['buzzerSwitchAccessory'] = new MiAirPurifier2BuzzerSwitchAccessory(this);
    }
    if(!this.config['ledBulbDisable'] && this.config['ledBulbName'] && this.config['ledBulbName'] != "") {
        this.accessories['ledBulbAccessory'] = new MiAirPurifier2LEDBulbAccessory(this);
    }
    if(!this.config['airQualityDisable'] && this.config['airQualityName'] && this.config['airQualityName'] != "") {
        this.accessories['airQualityAccessory'] = new MiAirPurifier2AirQualityAccessory(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[MiAirPurifierPlatform][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    return accessoriesArr;
}
inherits(MiAirPurifier2, Base);

MiAirPurifier2AirPurifierAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['airPurifierName'];
    this.silentModeSwitchDisable = dThis.config['silentModeSwitchDisable'];
    this.silentModeSwitchName = dThis.config['silentModeSwitchName'];
    this.platform = dThis.platform;
}

MiAirPurifier2AirPurifierAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier2")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);

    var silentModeSwitch = new Service.Switch(this.silentModeSwitchName);
    var silentModeOnCharacteristic = silentModeSwitch.getCharacteristic(Characteristic.On);
    if(!this.silentModeSwitchDisable) {
        services.push(silentModeSwitch);
    }
    
    var airPurifierService = new Service.AirPurifier(this.name);
    var activeCharacteristic = airPurifierService.getCharacteristic(Characteristic.Active);
    var currentAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.CurrentAirPurifierState);
    var targetAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.TargetAirPurifierState);
    var lockPhysicalControlsCharacteristic = airPurifierService.addCharacteristic(Characteristic.LockPhysicalControls);
    var rotationSpeedCharacteristic = airPurifierService.addCharacteristic(Characteristic.RotationSpeed);
    
    var currentTemperatureCharacteristic = airPurifierService.addCharacteristic(Characteristic.CurrentTemperature);
	var currentRelativeHumidityCharacteristic = airPurifierService.addCharacteristic(Characteristic.CurrentRelativeHumidity);
    var pm25DensityCharacteristic = airPurifierService.addCharacteristic(Characteristic.PM2_5Density);
    var airQualityCharacteristic = airPurifierService.addCharacteristic(Characteristic.AirQuality);
    services.push(airPurifierService);

    setInterval(function() {
        activeCharacteristic.getValue();
        currentAirPurifierStateCharacteristic.getValue();
        targetAirPurifierStateCharacteristic.getValue();
        lockPhysicalControlsCharacteristic.getValue();
        rotationSpeedCharacteristic.getValue();
        currentTemperatureCharacteristic.getValue();
        currentRelativeHumidityCharacteristic.getValue();
        pm25DensityCharacteristic.getValue();        
        airQualityCharacteristic.getValue();
    }, 1000);
    
    silentModeOnCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - SilentModeSwitch - getOn: " + result);
                
                if(result[0] === "silent") {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - SilentModeSwitch - getOn Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - SilentModeSwitch - setOn: " + value);
            if(value) {
                that.device.call("set_mode", ["silent"]).then(result => {
                    that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - SilentModeSwitch - setOn Result: " + result);
                    if(result[0] === "ok") {
                        targetAirPurifierStateCharacteristic.updateValue(Characteristic.TargetAirPurifierState.AUTO);
                        callback(null);
                        
                        if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                            activeCharacteristic.updateValue(Characteristic.Active.ACTIVE);
                            currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                        }
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - SilentModeSwitch - setOn Error: " + err);
                    callback(err);
                });
            } else {
                if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                    callback(null);
                } else {
                    that.device.call("set_mode", [Characteristic.TargetAirPurifierState.AUTO == targetAirPurifierStateCharacteristic.value ? "auto" : "favorite"]).then(result => {
                        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - SilentModeSwitch - setOn Result: " + result);
                        if(result[0] === "ok") {
                            callback(null);
                        } else {
                            callback(new Error(result[0]));
                        }
                    }).catch(function(err) {
                        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - SilentModeSwitch - setOn Error: " + err);
                        callback(err);
                    });
                }
            }
        }.bind(this));
    
    activeCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - Active - getActive: " + result);
                
                if(result[0] === "idle") {
                    callback(null, Characteristic.Active.INACTIVE);
                } else {
                    callback(null, Characteristic.Active.ACTIVE);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - Active - getActive Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - Active - setActive: " + value);
            that.device.call("set_power", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - Active - setActive Result: " + result);
                if(result[0] === "ok") {
                    currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.IDLE);
                    callback(null);
                    if(value) {
                        currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                        that.device.call("get_prop", ["mode"]).then(result => {
                            if(result[0] === "silent") {
                                silentModeOnCharacteristic.updateValue(true);
                            } else {
                                silentModeOnCharacteristic.updateValue(false);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - Active - setActive Error: " + err);
                            callback(err);
                        });
                    } else {
                        currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.INACTIVE);
                        silentModeOnCharacteristic.updateValue(false);
                    }
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - Active - setActive Error: " + err);
                callback(err);
            });
        }.bind(this));
       
    currentAirPurifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - CurrentAirPurifierState - getCurrentAirPurifierState: " + result);
                
                if(result[0] === "idle") {
                    callback(null, Characteristic.CurrentAirPurifierState.INACTIVE);
                } else {
                    callback(null, Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - CurrentAirPurifierState - getCurrentAirPurifierState Error: " + err);
                callback(err);
            });
        }.bind(this));

    lockPhysicalControlsCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["child_lock"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - LockPhysicalControls - getLockPhysicalControls: " + result);
                callback(null, result[0] === "on" ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - LockPhysicalControls - getLockPhysicalControls Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.device.call("set_child_lock", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - LockPhysicalControls - setLockPhysicalControls Result: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - LockPhysicalControls - setLockPhysicalControls Error: " + err);
                callback(err);
            });
        }.bind(this));
        
    targetAirPurifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + result);
                
                if(result[0] === "favorite") {
                    callback(null, Characteristic.TargetAirPurifierState.MANUAL);
                } else {
                    callback(null, Characteristic.TargetAirPurifierState.AUTO);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState: " + value);
            that.device.call("set_mode", [Characteristic.TargetAirPurifierState.AUTO == value ? (silentModeOnCharacteristic.value ? "silent" : "auto") : "favorite"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState Result: " + result);
                if(result[0] === "ok") {
                    if(Characteristic.TargetAirPurifierState.AUTO == value) {
                        callback(null);
                    } else {
                        that.device.call("get_prop", ["favorite_level"]).then(result => {
                            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + result);
                            silentModeOnCharacteristic.updateValue(false);
                            if(rotationSpeedCharacteristic.value <= result[0] * 10 && rotationSpeedCharacteristic.value > (result[0] - 1) * 10) {
                                callback(null);
                            } else {
                                rotationSpeedCharacteristic.value = result[0] * 10;
                                callback(null);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + err);
                            callback(err);
                        });
                    }
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState Error: " + err);
                callback(err);
            });
        }.bind(this));
    
    rotationSpeedCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["favorite_level"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - RotationSpeed - getRotationSpeed: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - RotationSpeed - getRotationSpeed Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - RotationSpeed - setRotationSpeed set: " + value);
            if(value == 0) {
                callback(null);
            } else {
                that.device.call("set_level_favorite", [parseInt(value / 10) < 10 ? parseInt(value / 10) + 1 : 10]).then(result => {
                    that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - RotationSpeed - setRotationSpeed Result: " + result);
                    if(result[0] === "ok") {
//                        that.device.call("set_mode", ["favorite"]).then(result => {
//                            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - RotationSpeed - setTargetAirPurifierState Result: " + result);
//                            if(result[0] === "ok") {
//                                targetAirPurifierStateCharacteristic.updateValue(Characteristic.TargetAirPurifierState.MANUAL);
//                                silentModeOnCharacteristic.updateValue(false);
                                  callback(null);
//                            } else {
//                                callback(new Error(result[0]));
//                            }
//                        }).catch(function(err) {
//                            that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - RotationSpeed - setTargetAirPurifierState Error: " + err);
//                            callback(err);
//                        });
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + err);
                    callback(err);
                })
            }
        }.bind(this));

    currentTemperatureCharacteristic.on('get', function(callback) {
        this.device.call("get_prop", ["temp_dec"]).then(result => {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - Temperature - getTemperature: " + result);
            callback(null, result[0] / 10);
        }).catch(function(err) {
            that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - Temperature - getTemperature Error: " + err);
            callback(err);
        });
    }.bind(this));

    currentRelativeHumidityCharacteristic
	    .on('get', function(callback) {
			this.device.call("get_prop", ["humidity"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - Humidity - getHumidity: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - Humidity - getHumidity Error: " + err);
                callback(err);
            });
	    }.bind(this));

    pm25DensityCharacteristic
	    .on('get', function(callback) {
			this.device.call("get_prop", ["aqi"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - aqi - getPM25Density: " + result);
                callback(null, result[0]);
                
                var airQualityValue = Characteristic.AirQuality.UNKNOWN;
                if(result[0] <= 50) {
                    airQualityValue = Characteristic.AirQuality.EXCELLENT;
                } else if(result[0] > 50 && result[0] <= 100) {
                    airQualityValue = Characteristic.AirQuality.GOOD;
                } else if(result[0] > 100 && result[0] <= 200) {
                    airQualityValue = Characteristic.AirQuality.FAIR;
                } else if(result[0] > 200 && result[0] <= 300) {
                    airQualityValue = Characteristic.AirQuality.INFERIOR;
                } else if(result[0] > 300) {
                    airQualityValue = Characteristic.AirQuality.POOR;
                } else {
                    airQualityValue = Characteristic.AirQuality.UNKNOWN;
                }
                airQualityCharacteristic.updateValue(airQualityValue);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - aqi - getPM25Density Error: " + err);
                callback(err);
            });
	    }.bind(this));

    // var filterMaintenanceService = new Service.FilterMaintenance(this.name);
    var filterChangeIndicationCharacteristic = airPurifierService.getCharacteristic(Characteristic.FilterChangeIndication);
    var filterLifeLevelCharacteristic = airPurifierService.addCharacteristic(Characteristic.FilterLifeLevel);

    filterChangeIndicationCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["filter1_life"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - FilterChangeIndication - getFilterChangeIndication: " + result);
                callback(null, result[0] < 5 ? Characteristic.FilterChangeIndication.CHANGE_FILTER : Characteristic.FilterChangeIndication.FILTER_OK);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - FilterChangeIndication - getFilterChangeIndication Error: " + err);
                callback(err);
            });
        }.bind(this));
    filterLifeLevelCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["filter1_life"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - FilterLifeLevel - getFilterLifeLevel: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - FilterLifeLevel - getFilterLifeLevel Error: " + err);
                callback(err);
            });
        }.bind(this));
    // services.push(filterMaintenanceService);

    return services;
}

MiAirPurifier2TemperatureAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['temperatureName'];
    this.platform = dThis.platform;
}

MiAirPurifier2TemperatureAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier2")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var temperatureService = new Service.TemperatureSensor(this.name);
    temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getTemperature.bind(this))
    services.push(temperatureService);
    
    return services;
}

MiAirPurifier2TemperatureAccessory.prototype.getTemperature = function(callback) {
    var that = this;
    this.device.call("get_prop", ["temp_dec"]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2TemperatureAccessory - Temperature - getTemperature: " + result);
        callback(null, result[0] / 10);
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2TemperatureAccessory - Temperature - getTemperature Error: " + err);
        callback(err);
    });
}

MiAirPurifier2HumidityAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['humidityName'];
    this.platform = dThis.platform;
}

MiAirPurifier2HumidityAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier2")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var humidityService = new Service.HumiditySensor(this.name);
    humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getHumidity.bind(this))
    services.push(humidityService);

    return services;
}

MiAirPurifier2HumidityAccessory.prototype.getHumidity = function(callback) {
    var that = this;
    this.device.call("get_prop", ["humidity"]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2HumidityAccessory - Humidity - getHumidity: " + result);
        callback(null, result[0]);
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2HumidityAccessory - Humidity - getHumidity Error: " + err);
        callback(err);
    });
}

MiAirPurifier2BuzzerSwitchAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['buzzerSwitchName'];
    this.platform = dThis.platform;
}

MiAirPurifier2BuzzerSwitchAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier2")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var switchService = new Service.Switch(this.name);
    switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getBuzzerState.bind(this))
        .on('set', this.setBuzzerState.bind(this));
    services.push(switchService);

    return services;
}

MiAirPurifier2BuzzerSwitchAccessory.prototype.getBuzzerState = function(callback) {
    var that = this;
    this.device.call("get_prop", ["buzzer"]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2BuzzerSwitchAccessory - BuzzerSwitch - getBuzzerState: " + result);
        callback(null, result[0] === "on" ? 1 : 0);
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2BuzzerSwitchAccessory - BuzzerSwitch - getBuzzerState Error: " + err);
        callback(err);
    });
}

MiAirPurifier2BuzzerSwitchAccessory.prototype.setBuzzerState = function(value, callback) {
    var that = this;
    that.device.call("set_buzzer", [value ? "on" : "off"]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2BuzzerSwitchAccessory - BuzzerSwitch - setBuzzerState Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2BuzzerSwitchAccessory - BuzzerSwitch - setBuzzerState Error: " + err);
        callback(err);
    });
}

MiAirPurifier2LEDBulbAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['ledBulbName'];
    this.platform = dThis.platform;
}

MiAirPurifier2LEDBulbAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier2")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var switchLEDService = new Service.Lightbulb(this.name);
    var onCharacteristic = switchLEDService.getCharacteristic(Characteristic.On);
    var brightnessCharacteristic = switchLEDService.addCharacteristic(Characteristic.Brightness);
    
    onCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["led_b"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2LEDBulbAccessory - switchLED - getLEDPower: " + result);
                callback(null, result[0] === 2 ? false : true);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2LEDBulbAccessory - switchLED - getLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2LEDBulbAccessory - switchLED - setLEDPower: " + value + ", nowValue: " + onCharacteristic.value);
            that.setLedB(value ? that.getLevelByBrightness(brightnessCharacteristic.value) : 2, callback);
        }.bind(this));
    brightnessCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["led_b"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2LEDBulbAccessory - switchLED - getLEDPower: " + result);
                if(result[0] == 0) {
                    if(brightnessCharacteristic.value > 50 && brightnessCharacteristic.value <= 100) {
                        callback(null, brightnessCharacteristic.value);
                    } else {
                        callback(null, 100);
                    }
                } else if(result[0] == 1) {
                    if(brightnessCharacteristic.value > 0 && brightnessCharacteristic.value <= 50) {
                        callback(null, brightnessCharacteristic.value);
                    } else {
                        callback(null, 50);
                    }
                } else if(result[0] == 2) {
                    callback(null, 0);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2LEDBulbAccessory - switchLED - getLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(switchLEDService);

    return services;
}

MiAirPurifier2LEDBulbAccessory.prototype.setLedB = function(led_b, callback) {
    var that = this;
    that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2LEDBulbAccessory - switchLED - setLedB: " + led_b);
    this.device.call("set_led_b", [led_b]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2LEDBulbAccessory - switchLED - setLEDBrightness Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2LEDBulbAccessory - switchLED - setLEDBrightness Error: " + err);
        callback(err);
    });
}

MiAirPurifier2LEDBulbAccessory.prototype.getLevelByBrightness = function(brightness) {
    if(brightness == 0) {
        return 2;
    } else if(brightness > 0 && brightness <= 50) {
        return 1;
    } else if (brightness > 50 && brightness <= 100) {
        return 0;
    }
}

MiAirPurifier2AirQualityAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['airQualityName'];
    this.platform = dThis.platform;
}

MiAirPurifier2AirQualityAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];
    
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier2")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var pmService = new Service.AirQualitySensor(this.name);
    var pm2_5Characteristic = pmService.addCharacteristic(Characteristic.PM2_5Density);
    pmService
        .getCharacteristic(Characteristic.AirQuality)
        .on('get', function(callback) {
            that.device.call("get_prop", ["aqi"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirQualityAccessory - AirQuality - getAirQuality: " + result);
                
                pm2_5Characteristic.updateValue(result[0]);
                
                if(result[0] <= 50) {
                    callback(null, Characteristic.AirQuality.EXCELLENT);
                } else if(result[0] > 50 && result[0] <= 100) {
                    callback(null, Characteristic.AirQuality.GOOD);
                } else if(result[0] > 100 && result[0] <= 200) {
                    callback(null, Characteristic.AirQuality.FAIR);
                } else if(result[0] > 200 && result[0] <= 300) {
                    callback(null, Characteristic.AirQuality.INFERIOR);
                } else if(result[0] > 300) {
                    callback(null, Characteristic.AirQuality.POOR);
                } else {
                    callback(null, Characteristic.AirQuality.UNKNOWN);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirQualityAccessory - AirQuality - getAirQuality Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(pmService);

    return services;
}