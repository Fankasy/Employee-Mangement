const express = require("express");
var bodyParser = require("body-parser");

const path = require("path");
const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

const mongodbConnect = require("./database.js");

const db = mongoose.connection;
const app = new express();

// Connect to mongodb

mongodbConnect();
// import models
const Employee = require("./Employee.js");
//console.log(Employee.collection.collectionName);

// Server Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(
    "A " + req.method + " request " + req.url + " received at " + new Date()
  );
  next();
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});

// get list of employees

app.get("/api/employees/:page", (req, res) => {
  let options = {
    page: parseInt(req.params.page),
    limit: 5
    //sort: { lastname: req.params.seq }
  };
  Employee.paginate({}, options, (err, employee) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json({ employee });
    }
  });
});

// get an employee reporters details
app.get("/api/employee/reporters/:employeeId", (req, res) => {
  Employee.findById(req.params["employeeId"], (err, employee) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      let reports = employee.directReports.toString();
      Employee.find({}, (err, all) => {
        if (err) {
          res.status(500).json({ error: err });
        } else {
          res.status(200).json({
            reporters: all.filter(em => reports.includes(em.id))
          });
        }
      });
    }
  });
});

// get an employee manager details
app.get("/api/employee/manager/:employeeId", (req, res) => {
  Employee.findById(req.params["employeeId"], (err, employee) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      let manager = employee.manager.toString();
      //console.log(typeof manager)
      Employee.find({}, (err, all) => {
        if (err) {
          res.status(500).json({ error: err });
        } else {
          res.status(200).json({
            manager: all.filter(em => manager === em.id)
          });
        }
      });
    }
  });
});

// add a new employee

app.post("/api/employee", (req, res) => {
  if (!req.body.manager) {
    Employee.create(req.body, (err, employee) => {
      if (err) {
        res.status(500).json({ error: err });
      } else {
        Employee.find({}, (err, employee) => {
          if (err) {
            res.status(500).json({ error: err });
          } else {
            res.status(200).json({ employee });
          }
        });
      }
    });
  } else {
    Employee.create(req.body, (err, employee) => {
      if (err) {
        res.status(500).json({ error: err });
      } else {
        Employee.findById(req.body.manager, (err, manager) => {
          if (err) {
            res.status(500).json({ error: err });
          } else {
            let newManager = Object.assign({}, manager._doc);
            newManager.directReports = [
              ...newManager.directReports,
              employee._id
            ];
            Employee.findByIdAndUpdate(
              req.body.manager,
              newManager,
              (err, manager) => {
                if (err) {
                  res.status(500).json({ error: err });
                } else {
                  Employee.find({}, (err, employee) => {
                    if (err) {
                      res.status(500).json({ error: err });
                    } else {
                      res.status(200).json({ employee });
                    }
                  });
                }
              }
            );
          }
        });
      }
    });
  }
});

// modify an exist employee

app.put("/api/employee/:employeeId", (req, res) => {
  Employee.findByIdAndUpdate(
    req.params["employeeId"],
    req.body,
    (err, employee) => {
      if (err) {
        res.status(500).json({ error: err });
      } else {
        if (employee != null) {
          let obj = employee._doc;
          //name change
          if (obj.name !== req.body.name) {
            if (obj.directReports.length > 0) {
              obj.directReports.forEach(report => {
                Employee.findById(report, (err, employee) => {
                  if (err) {
                    console.log(err);
                    res.status(500).json({ error: err });
                  } else {
                    if (employee !== null) {
                      let newReporter = Object.assign({}, employee._doc);
                      newReporter.managerName = req.body.name;
                      Employee.findByIdAndUpdate(
                        report,
                        newReporter,
                        (err, employee) => {
                          if (err) {
                            res.status(500).json({ error: err });
                          }
                        }
                      );
                    }
                  }
                });
              });
            }
          }
          // manager dosen`t change
          if (obj.manager===req.body.manager||(obj.manager!==null&&obj.manager.toString() === req.body.manager)) {
            Employee.findByIdAndUpdate(
              req.params["employeeId"],
              req.body,
              (err, employee) => {
                if (err) {
                  res.status(500).json({ error: err });
                } else {
                  Employee.find({}, (err, employee) => {
                    if (err) {
                      res.status(500).json({ error: err });
                    } else {
                      res.status(200).json({ employee });
                    }
                  });
                }
              }
            );
          } else {
            // delete previous manager
            if (employee.manager !== null) {
              Employee.findById(obj.manager, (err, manager) => {
                if (err) {
                  res.status(500).json({ error: err });
                } else {
                  if (manager !== null) {
                    let newManager = Object.assign({}, manager._doc);
                    newManager.directReports = newManager.directReports.filter(
                      user => user.toString() !== req.params["employeeId"]
                    );
                    Employee.findByIdAndUpdate(
                      obj.manager,
                      newManager,
                      (err, manager) => {
                        if (err) {
                          res.status(500).json({ error: err });
                        }
                      }
                    );
                  }
                }
              });
            }

            // add to new manager`s reportors
            if (req.body.manager !== null) {
              Employee.findById(req.body.manager, (err, manager) => {
                if (err) {
                  res.status(500).json({ error: err });
                } else {
                  if (manager !== null) {
                    let newManager = Object.assign({}, manager._doc);
                    newManager.directReports = [
                      ...newManager.directReports,
                      obj._id
                    ];
                    Employee.findByIdAndUpdate(
                      req.body.manager,
                      newManager,
                      (err, manager) => {
                        if (err) {
                          res.status(500).json({ error: err });
                        } else {
                          Employee.find({}, (err, employee) => {
                            if (err) {
                              res.status(500).json({ error: err });
                            } else {
                              res.status(200).json({ employee });
                            }
                          });
                        }
                      }
                    );
                  }
                }
              });
            }
          }
        }
      }
    }
  );
});

// delete an exist employee

app.delete("/api/employee/:employeeId", (req, res) => {
  Employee.findByIdAndRemove(req.params["employeeId"], (err, employee) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      if (employee !== null) {
        let obj = employee._doc;
        console.log(obj.manager);
        // w/ manager
        if (obj.manager !== null) {
          Employee.findById(obj.manager, (err, manager) => {
            if (err) {
              res.status(500).json({ error: err });
            } else {
              if (manager !== null) {
                let newManager = Object.assign({}, manager._doc);
                let index = newManager.directReports.indexOf(
                  req.params["employeeId"]
                );
                newManager.directReports = [
                  ...newManager.directReports.slice(0, index),
                  ...newManager.directReports.slice(
                    index + 1,
                    newManager.directReports.length
                  )
                ];
                Employee.findByIdAndUpdate(
                  obj.manager,
                  newManager,
                  (err, manager) => {
                    if (err) {
                      res.status(500).json({ error: err });
                    } else {
                      if (obj.directReports.length > 0) {
                        //with manager and with directReports: delete DR from manager, update reporters manager, update manager new DR
                        obj.directReports.forEach(report => {
                          Employee.findById(report, (err, employee) => {
                            if (err) {
                              res.status(500).json({ error: err });
                            } else {
                              if (employee !== null) {
                                let newReporter = Object.assign(
                                  {},
                                  employee._doc
                                );
                                newReporter.manager = obj.manager;
                                newReporter.managerName = obj.managerName;
                                Employee.findByIdAndUpdate(
                                  report,
                                  newReporter,
                                  (err, employee) => {
                                    if (err) {
                                      res.status(500).json({ error: err });
                                    }
                                  }
                                );
                              }
                            }
                          });
                        });
                        Employee.findById(obj.manager, (err, manager) => {
                          if (err) {
                            res.status(500).json({ error: err });
                          } else {
                            if (manager !== null) {
                              let newManager = Object.assign({}, manager._doc);
                              newManager.directReports = [
                                ...newManager.directReports,
                                ...obj.directReports
                              ];
                              Employee.findByIdAndUpdate(
                                obj.manager,
                                newManager,
                                (err, manager) => {
                                  if (err) {
                                    res.status(500).json({ error: err });
                                  } else {
                                    Employee.find({}, (err, employee) => {
                                      if (err) {
                                        res.status(500).json({ error: err });
                                      } else {
                                        res.status(200).json({ employee });
                                      }
                                    });
                                  }
                                }
                              );
                            } else {
                              Employee.find({}, (err, employee) => {
                                if (err) {
                                  res.status(500).json({ error: err });
                                } else {
                                  res.status(200).json({ employee });
                                }
                              });
                            }
                          }
                        });
                      } else {
                        //with manager but without DR: just delete DR from manager
                        Employee.find({}, (err, employee) => {
                          if (err) {
                            res.status(500).json({ error: err });
                          } else {
                            res.status(200).json({ employee });
                          }
                        });
                      }
                    }
                  }
                );
              }
            }
          });
        } else {
          console.log(obj.directReports.length);
          //without manager but with DR: set reporters manager to null
          if (obj.directReports.length > 0) {
            obj.directReports.forEach(report => {
              Employee.findById(report, (err, employee) => {
                if (err) {
                  res.status(500).json({ error: err });
                } else {
                  if (employee !== null) {
                    let newReporter = Object.assign({}, employee._doc);
                    newReporter.manager = null;
                    newReporter.managerName = null;
                    Employee.findByIdAndUpdate(
                      report,
                      newReporter,
                      (err, employee) => {
                        if (err) {
                          res.status(500).json({ error: err });
                        }
                      }
                    );
                  }
                }
              });
            });
          }
          //without manager without DR: just delete the em
          Employee.find({}, (err, employee) => {
            if (err) {
              res.status(500).json({ error: err });
            } else {
              res.status(200).json({ employee });
            }
          });
        }
      } else {
        res.json({ message: "employee doesn`t exist." });
      }
    }
  });
});

// get the results match the key(accessed at GET http://localhost:8080/api/search/:key)
app.get("/api/search/:key", (req, res) => {
  var query = req.params.key.replace(" ", "|");
  var regex = new RegExp(query, "i"); // 'i' makes it case insensitive
  Employee.find(
    {
      $or: [
        { name: regex },
        { title: regex },
        { sex: regex },
        { managerName: regex }
      ]
    },
    function(err, results) {
      if (err) res.status(500).send(err);
      res.status(200).json(results);
    }
  );
});

//get all manager list for add
app.get("/api/employee/allManagers", (req, res) => { 
  Employee.find({}, (err, all) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json({
        validManagers: all.map(m => {
          const r = (({ name, _id }) => ({ name, _id }))(m);
          return r;
        })
      });
    }
  });
});

//get the valid managers: get all below dr and filter out from all manager, then we get valid manager
app.get("/api/employee/validManagers/:emId", (req, res) => {
  
  
    Employee.aggregate(
      [
        { $match: { _id: mongoose.Types.ObjectId(req.params.emId) } },
        {
          $graphLookup: {
            from: "users",
            startWith: "$directReports",
            connectFromField: "directReports",
            connectToField: "_id",
            as: "chain"
          }
        },
        {
          $project: {
            drChain: "$chain._id"
          }
        }
      ],
      (err, results) => {
        if (err) res.status(500).send(err);

        let self = results[0]._id.toString();
        //haoconsole.log(self);
        let notValid = results[0].drChain.map(dr => dr.toString());
        Employee.find({}, (err, all) => {
          if (err) {
            res.status(500).json({ error: err });
          } else {
            let managers = all.filter(
              em => !notValid.includes(em.id) && self !== em.id
            );
            res.status(200).json({
              validManagers: managers.map(m => {
                const r = (({ name, _id }) => ({ name, _id }))(m);
                return r;
              })
            });
          }
        });
      }
    );
  
});

app.listen(8080, () => {
  console.log("Listening to port 8080.");
});
