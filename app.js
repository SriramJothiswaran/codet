const express = require('express');
const app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
const ejs = require('ejs');
const path = require('path');
const bodyParser = require('body-parser');
var five = require("johnny-five");
const fs = require('fs');
var moment = require('moment');
const mongoose = require('mongoose');
var json2csv = require('json2csv');
var fields = ['id', 'inletTemp', 'outletTemp', 'readDate'];



const tempSchema = new mongoose.Schema({
    inletTemp: String,
    outletTemp: String,
    readTime: String,
    readDate: Date
});


const startSchema = new mongoose.Schema({
    startTime: String,
    startDate: Date
});

const compareSchema = new mongoose.Schema({ 
    compareTime: String,
     compareDate : Date, 
    compareTemp : String
 });

const predictSchema = new mongoose.Schema({
    predictTime: String,
    predictDate : Date,
    predictTemp : String
});




const tempModel = mongoose.model('tempModel', tempSchema);
const startModel = mongoose.model('startModel', startSchema);
const compareModel = mongoose.model('compareModel', compareSchema);
const predictModel = mongoose.model('predictModel', predictSchema);



//mongoose.connect('mongodb://localhost/tempapp');
mongoose.connect('mongodb://codet:codet123@ds119436.mlab.com:19436/codet');



mongoose.connection.on('error', function (err) {
    console.error(err);
    console.log('%s MongoDB connection error. Please make sure MongoDB is running.');
    process.exit();

});


var board = new five.Board();

var tempValue = "";


board.on("ready", function () {
    var inletTemp = null;
    var outletTemp = null;
    // This requires OneWire support using the ConfigurableFirmata
    var thermometer = new five.Thermometer({
        controller: "DS18B20",
        pin: 3
    });

    var thermometer2 = new five.Thermometer({
        controller: "DS18B20",
        pin: 2
    });


    io.on('connection', function (socket) {
        console.log('A user connected');


        thermometer.on("change", function () {
            inletTemp = this.celsius;


            socket.emit('news', {value: this.celsius});


            difference(inletTemp, outletTemp);


        });

        thermometer2.on("change", function () {
            outletTemp = this.celsius;
            var checkDate = new Date().getTime();
            startModel.find({}, function (err, docs) {
                if (docs[0].startTime + 300 > checkDate) {

                    compareModel.find({}, function (err, doc) {
                        if (doc.length == 0) {
                            var compareData = new compareModel({
                                compareTime: checkDate,
                                compareDate: new Date().getDate(),
                                compareTemp: outletTemp
                            });
                            compareData.save().then(function (doc) {
                                //console.log(doc);
                            }, function (e) {
                                console.log(e)
                            });
                        } else {
                            console.log("temp");

                            if(Math.round(doc[0].compareTemp) != Math.round(outletTemp)){
                                var predictData = new predictModel({
                                    predictTime: checkDate,
                                    predictDate: new Date().getDate(),
                                    predictTemp: Math.round(outletTemp)
                                });
                                predictData.save().then(function (presave) {
                                    console.log(presave);
                                }, function (e) {
                                    console.log(e)
                                });

                                predictModel.find({},function(err,predoc){
                                    var tempDiff = null;
                                    var dateDiff = null;
                                    var avg = null;

                                   for(i=0;i<predoc.length;i++){
                                       tempDiff = predoc[predoc.length - 1].predictTemp - predoc[0].predictTemp;
                                       dateDiff = predoc[predoc.length - 1].predictDate - predoc[0].predictDate;
                                       avg = (65 - predoc[predoc.length - 1].predictTemp )*(tempDiff/dateDiff);
                                       console.log(avg);
                                       socket.emit('message', {value: avg});





                                   }
                                });

                            }

                        }
                    });
                }
            });

            socket.emit('tempera', {value: this.celsius});
            console.log('outlet: ' + outletTemp)

            console.log("User 2 : " + this.celsius + "°C");
            difference(inletTemp, outletTemp);
            // console.log("0x" + this.address.toString(16));
        });

        function difference(a, b) {
            if (a == null || b == null) {
                console.log("initializing");
            } else {
                var tempData = new tempModel({
                    inletTemp: a,
                    outletTemp: b,
                    readTime: new Date().getTime(),
                    readDate: new Date()

                });
                tempData.save().then(function (doc) {
                    //console.log(doc);
                }, function (e) {
                    console.log(e)
                });
                c=a-b;
                console.log(c);
                var logMessage = "\n" + moment().format('MMMM Do YYYY, h:mm:ss a') + ": Inlet Temperature: " + a + "°C" + " and  Outlet Temperature: " + b + "°C" + " Gap: " + c +"°C";
                fs.appendFile('log.txt', logMessage, (err) => {
                    if (err) throw err;
                    //console.log('The data was appended to file!');
                });
                socket.emit('difference', {value: a - b});


            }
        }


        //Whenever someone disconnects this piece of code executed
        socket.on('disconnect', function () {
            console.log('A user disconnected');
        });
    });


});


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/data', function (req, res) {
    console.log('inside post');
    startModel.find().count(function (err, count) {
        console.log('count ' + count)
        if (count == 0) {
            var startData = new startModel({
                startModel: new Date().getTime(),
                startDate: new Date()
            });
            startData.save().then(function (doc) {
                console.log(doc);
            }, function (e) {
                console.log(e)
            });

        } else {
            startModel.update({}, {startModel: new Date().getTime(), startDate: new Date()}, function (err, data) {
                if (err) {
                    console.log('error occured while update' + err);
                } else {
                    console.log(data);
                }

            });


        }
    });
});

app.post('/temphistory',function(req,res){
    var newTemp = new Date(req.body.date);
    var searchDate = new Date(req.body.date);
    newTemp.setDate(newTemp.getDate() + 1); // minus the date
    searchDate.setDate(searchDate.getDate() - 1); // minus the date



    tempModel.find({readDate: {$lte:new Date(newTemp),"$gte": new Date(searchDate)}},function(err,docs){


        res.json(docs);
    })
});


http.listen(3000, function () {
    console.log('listening on *:3000');
});



