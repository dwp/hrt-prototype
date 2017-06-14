module.exports = (router, config) => {

	// ###########################################################################
	// helper constants
	// ###########################################################################

	// each sub-application (version) gets some specific data about it:
	const appData = config.data

	// this is a URL route to the apps 'root' redirect use this
	const appRoot = config.route.root

	// to use 'render' use this
	const appRootRel = config.route.rootRel

	// this will create a route that targets all pages:
	const allPages = `${appRoot}/**/*`

	// you can write a route for specific pages/directories using the
	// appRoot variable.
	// For example if your subapplication / version is in a directory
	// called 'live' then the output would be
	// /apps/live/views/index
	router.all(`${appRoot}/index`, function(req,res,next) {
		next()
	})

	// Readable outcomes
	const outcomes = {
	  british: {
	      id: 'END001',
	      status: 'British / Irish national'
	  },
	  employedEEA: {
	      id: 'END002',
	      status: 'EEA worker'
	  },
	  ineligible: {
	      id: 'END003',
	      status: 'Ineligible'
	  },
	  noRecourseToPublicFunds: {
	      id: 'END004',
	      status: 'No recourse to public funds'
	  },
	  selfEmployedEEA: {
	      id: 'END006',
	      status: 'Self-employed EEA citizen'
	  },
	  permanentResident: {
	      id: 'END007',
	      status: 'Permanent resident'
	  },
	  refugee: {
	      id: 'END008',
	      status: 'Refugee'
	  },
	  leaveToRemain: {
	      id: 'END009',
	      status: 'Settlement, indefinite or limited leave to remain'
	  },
	  redundantEEA: {
	      id: 'END010',
	      status: 'Redundant EEA citizen'
	  },
	  sickEEA: {
	      id: 'END011',
	      status: 'Temporarily sick EEA citizen'
	  },
	  derivedRightsEEA: {
	      id: 'END012',
	      status: 'Spouse of EEA citizen'
	  },
	  derivedRightsNonEEA: {
	      id: 'END013',
	      status: 'Spouse of EEA citizen'
	  },
	  bookFurtherEvidenceInterview: {
	    id: 'END014',
	    status: 'Returning British national with no passport on the day of initial interview'
	  },
	  bookFurtherEvidenceInterviewBRP: {
	    id: 'END015',
	    status: 'NonEEA with no BRP on the day of the initial interview'
	  },
	  bookFurtherEvidenceInterviewMarriage: {
	    id: 'END016',
	    status: 'Married NonEEA with no marriage certificate on the day of the initial interview'
	  }
	}

	config.isPartnerFlowEnabled = true

	// ####################################################################
	// Set up locals/session for all routes
	// ####################################################################
	router.all(`${appRoot}/**/*`, function(req, res, next) {

	  var answers = req.session[config.slug].answers || { claimant: {}, partner: {} };
	  var isPartnerFlow = answers.claimant.partner === 'yes';

	  // Allow partner override by query string
	  if (typeof req.query.partner !== 'undefined') {
	    isPartnerFlow = true;
	  }

	  // Allow claimant override by query string
	  if (typeof req.query.claimant !== 'undefined') {
	    isPartnerFlow = false;
	  }

	  // Claimant type suffix
	  var claimantType = isPartnerFlow ? 'partner' : 'claimant';

	  res.locals.currentApp.isPartnerFlow = isPartnerFlow;
	  res.locals.currentApp.claimantType = claimantType;
	  req.session[config.slug].answers = answers;

	  next();
	});

	// ####################################################################
	// Intercept outcome pages, check for partner
	// ####################################################################
	router.all(`${appRoot}/outcomes/:outcomeId`, function (req, res, next) {

		var isPartnerFlow = res.locals.currentApp.isPartnerFlow;
	  var outcomeId = req.params.outcomeId;
		var claimantType = res.locals.currentApp.claimantType;
	  var answers = req.session[config.slug].answers;

	  for (outcome in outcomes) {
	    if (outcomes[outcome].id === outcomeId) {
	      res.locals.currentApp.claimantStatus = outcomes[outcome].status;
	      break;
	    }
	  }

	  // Skip if partner flow disabled
	  if (config.isPartnerFlowEnabled) {

	    // Not asked about partner yet
	    if (typeof answers.claimant.partner === 'undefined') {

	      // Save outcome
	      answers.claimant.outcomeId = outcomeId;

	      // Ineligible claimant (but might qualify for derived rights)
	      if (outcomeId === outcomes.ineligible.id &&
	        (answers.claimant.isEEA && answers.claimant.dontWorkReason === 'other') ||
	          (!answers.claimant.isEEA && answers.claimant.noRecourseToPublicFunds === 'no'
	           && answers.claimant.familyMember === 'no')) {

	        // Mark as derived rights flow
	        answers.claimant.isDerivedRightsFlow = true;

	        // Redirect to partner flow
	        res.redirect(`${appRoot}/questions/partner?claimant`);
	        return;
	      }
	    }

	    // Has partner, override outcome based on claimant
	    else if (answers.claimant.partner === 'yes' && answers.claimant.outcomeId) {

	      // Save outcome
	      answers.partner.outcomeId = outcomeId;

	      // Does claimant outcome differ? Partner must be eligible
	        if (answers.claimant.outcomeId !== outcomeId && outcomeId !== outcomes.ineligible.id) {

	          // Ineligible claimant (derived rights)
	          if (answers.claimant.outcomeId === outcomes.ineligible.id) {

	            // Skip if already on derived rights outcome
	            if (outcomeId !== outcomes.derivedRightsNonEEA.id && outcomeId !== outcomes.derivedRightsEEA.id) {

	              // Ineligible claimant + derived rights partner
	              if (outcomeId === outcomes.employedEEA.id ||
	                outcomeId === outcomes.sickEEA.id ||
	                outcomeId === outcomes.redundantEEA.id) {

	                // Force outcome to derived rights
	                answers.partner.outcomeId = answers.claimant.isEEA ?
	                  outcomes.derivedRightsEEA.id : outcomes.derivedRightsNonEEA.id;

	                // Redirect to derived rights
	                res.redirect(`${appRoot}/outcomes/${answers.partner.outcomeId}?${claimantType}`);
	                return;
	              }

	              // Otherwise still ineligible
	              else {
	                res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	                return;
	              }
	            }
	          }

	        // Both reached eligible outcome
	        else {
	          res.redirect(`${appRoot}/outcomes/${answers.claimant.outcomeId}?${claimantType}`);
	          return;
	        }
	      }
	    }
	  }

	  // Render requested outcome
	  res.render(`${appRootRel}/outcomes/${outcomeId}`);

	});

	// ####################################################################
	// Branching for UK citizens
	// ####################################################################
	router.all(`${appRoot}/questions/uk-national`, function (req, res) {
	  var ukNational = req.body.ukNational;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

	  if (ukNational) {
	    answers[claimantType].ukNational = ukNational;

	    // UK national
	    if (ukNational == 'yes') {
	      answers[claimantType].isEEA = true;
	      res.redirect(`${appRoot}/questions/british-passport-today?${claimantType}`);
	    }

	    // Non-UK national
	    else if (ukNational == 'no') {
	      res.redirect(`${appRoot}/questions/refugee?${claimantType}`);
	    }

	    else if (res.locals.currentApp.isPartnerFlow && ukNational === 'unknown') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    }
	  }

	  else {
	    res.render(`${appRootRel}/questions/uk-national`);
	  }

	});

	// ####################################################################
	// Branching for citizens with a passport on the day
	// ####################################################################
	router.all(`${appRoot}/questions/british-passport-today`, function (req, res) {
	  var hasBritishPassportToday = req.body.britishPassportToday;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

	  if (hasBritishPassportToday) {
	    answers[claimantType].hasBritishPassportToday = hasBritishPassportToday;

	    // Has British passport with them
	    if (hasBritishPassportToday == 'yes') {
	      answers[claimantType].isEEA = true;
	      res.redirect(`${appRoot}/questions/british-citizen?${claimantType}`);
	    }

	    // Don't have their British passport with them
	    else if (hasBritishPassportToday == 'no') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    }

	  }

	  else {
	    res.render(`${appRootRel}/questions/british-passport-today`);
	  }

	});

	// ####################################################################
	// Branching for citizens with a british passport and british citizen
	// ####################################################################
	router.all(`${appRoot}/questions/british-citizen`, function (req, res) {
		var isBritishCitizen = req.body.britishCitizen;
		var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (isBritishCitizen) {
			answers[claimantType].isBritishCitizen = isBritishCitizen;

			// UK national
			if (isBritishCitizen == 'yes') {
				answers[claimantType].isEEA = true;
				res.redirect(`${appRoot}/outcomes/${outcomes.british.id}?${claimantType}`);
			}

			// Non-UK national
			else if (isBritishCitizen == 'no') {
				res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
			}

		}

		else {
			res.render(`${appRootRel}/questions/british-citizen`);
		}

	});


	// ####################################################################
	// refuge
	// ####################################################################
	router.all(`${appRoot}/questions/refugee`, function (req, res) {
	  var refugee = req.body.refugee;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

	  if (refugee) {
	    answers[claimantType].refugee = refugee;

	    // Refugee
	    if (refugee === 'yes') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.refugee.id}?${claimantType}`);
	    }

	    // Non-refugee
	    else if (refugee === 'no') {
	      res.redirect(`${appRoot}/questions/nationality?${claimantType}`);
	    }

	    else if (res.locals.currentApp.isPartnerFlow && refugee === 'unknown') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    }
	  }

	  else {
	    res.render(`${appRootRel}/questions/refugee`);
	  }
	});

	// ####################################################################
	// Checking claimants nationality
	// ####################################################################

	router.all(`${appRoot}/questions/nationality`, function (req, res) {
	  var nationality = req.body.nationality;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

		console.log(req.body);

	  if (nationality) {
	    answers[claimantType].nationality = nationality;

      console.log(nationality);

	    // List countries, pull out names
	    var listEEA = res.locals.countriesByEEA;
	    var listNonEEA = res.locals.countriesByNonEEA;

	    // EEA nationality
	    if (listEEA.indexOf(nationality) !== -1) {
	      answers[claimantType].isEEA = true;

	      // Croatia straight to outcome
	      if (nationality === 'Croatia') {
	        res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	      } else if(nationality === 'Ireland') {
          res.redirect(`${appRoot}/outcomes/${outcomes.british.id}?${claimantType}`);
        }

	      // Continue
	      res.redirect(`${appRoot}/questions/employee-status?${claimantType}`);
	    }

	    // Non-EEA nationality
	    else if (listNonEEA.indexOf(nationality) !== -1) {
	      answers[claimantType].isEEA = false;
	      res.redirect(`${appRoot}/questions/biometric-residence-permit?${claimantType}`);
	    }
	  }

	  else {
	    res.render(`${appRootRel}/questions/nationality`);
	  }
	});

	// ####################################################################
	// Checking if EEA employment status
	// ####################################################################

	router.all(`${appRoot}/questions/employee-status`, function (req, res) {
	  var employeeStatus = req.body.employeeStatus;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

	  // Ineligible claimant (derived rights), UK straight to outcome
	  if (answers.claimant.isDerivedRightsFlow && answers.partner.nationality === 'United Kingdom') {
	    res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    return;
	  }

	  if (employeeStatus) {

	    answers[claimantType].employeeStatus = employeeStatus;

	    // Self-employed
	    if (employeeStatus.selfEmployed === 'true') {
				res.redirect(`${appRoot}/questions/when-did-they-start-self-employment?${claimantType}`);
	    }

	    // Employed
	    else if (employeeStatus.employed === 'true') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.employedEEA.id}?${claimantType}`);
	    }

	    // Not working
	    else if (employeeStatus.dontWork === 'true') {
	      res.redirect(`${appRoot}/questions/employee-status-dont-work?${claimantType}`);
	    }

	  } else {
	    res.render(`${appRootRel}/questions/employee-status`);
	  }
	});

	// ####################################################################
	// Checking why an EEA claimant doesn't work
	// ####################################################################

	router.all(`${appRoot}/questions/employee-status-dont-work`, function (req, res) {
	  var dontWorkReason = req.body.dontWorkReason;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

	  if (dontWorkReason) {
	    answers[claimantType].dontWorkReason = dontWorkReason;

	    // Redundant
	    if (dontWorkReason === 'redundant') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.redundantEEA.id}?${claimantType}`);
	    }

	    // Sick
	    if (dontWorkReason === 'sick') {
	      res.redirect(`${appRoot}/questions/fitnote?${claimantType}`);
	    }

	    // Other or Partner reason unknown
	    else if (dontWorkReason === 'other' || res.locals.currentApp.isPartnerFlow && dontWorkReason === 'unknown') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    }
	  }

	  else {
	    res.render(`${appRootRel}/questions/employee-status-dont-work`);
	  }
	});

	// ####################################################################
	// Checking if a sick EEA claimant has a fit note
	// ####################################################################

	router.all(`${appRoot}/questions/fitnote`, function(req, res) {
	  var hasFitNote = req.body.hasFitNote;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

	  if(hasFitNote) {

			if(hasFitNote == 'yes') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.sickEEA.id}?${claimantType}`);
	    }

			else if (hasFitNote == 'no') {

				if(!!answers.claimant.outcomeId) {
	        res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	      }

				else {
	        answers.claimant.isDerivedRightsFlow = true;
	        answers.claimant.outcomeId = outcomes.ineligible.id;
	        res.redirect(`${appRoot}/questions/partner?${claimantType}`);
	      }
	    }

			else if (hasFitNote == 'unknown') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    }
	  }

		else {
	    res.render(`${appRootRel}/questions/fitnote`);
	  }
	});

	// ####################################################################
	// EEA out of work Partner questions
	// ####################################################################

	router.all(`${appRoot}/questions/partner`, function (req, res) {
	  var partner = req.body.partner;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

	  // Mark as derived rights flow (updates question text)
	  res.locals.currentApp.isDerivedRightsFlow = answers.claimant.isDerivedRightsFlow;

	  if (partner && answers.claimant.outcomeId) {
	    answers[claimantType].partner = partner;

	    // No partner or partner flow disabled
	    if (partner === 'no' || !config.isPartnerFlowEnabled) {
	      res.redirect(`${appRoot}/outcomes/${answers.claimant.outcomeId}?claimant`);
	    }

	    // Has a partner
	    else if (partner === 'yes') {
	      // Ineligible claimant (derived rights), skip to nationality
	      if (answers.claimant.isDerivedRightsFlow) {
	        res.redirect(`${appRoot}/questions/nationality?partner`);
	      }

	      // Assume still qualifying
	      else {
	        res.redirect(`${appRoot}/questions/uk-national?partner`);
	      }
	    }
	  }

	  else {
	    res.render(`${appRootRel}/questions/partner`);
	  }
	});

	// ####################################################################
	// Checking if non EEA claimant has a BRP (doesn't change routing)
	// ####################################################################
	router.all(`${appRoot}/questions/biometric-residence-permit`, function (req, res) {
		var brp = req.body.brp;
		var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (brp) {

			answers[claimantType].brp = brp;

			// They have a biometric residency permit
			if (brp == 'yes') {
				res.redirect(`${appRoot}/questions/no-recourse-to-public-funds?${claimantType}`);
			}

			// Non-UK national
			else if (brp == 'no') {
				res.redirect(`${appRoot}/questions/no-recourse-to-public-funds?${claimantType}`);
			}

		}

		else {
			res.render(`${appRootRel}/questions/biometric-residence-permit`);
		}

	});

	// ####################################################################
	// Does the claimant have no recourse to public funds
	// ####################################################################

	router.all(`${appRoot}/questions/no-recourse-to-public-funds`, function (req, res) {
	  var noRecourseToPublicFunds = req.body.noRecourseToPublicFunds;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

	  // Ineligible claimant (derived rights), partner must be EEA
	  if (answers.claimant.isDerivedRightsFlow && !answers.partner.isEEA) {
	    res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    return;
	  }

	  if (noRecourseToPublicFunds) {
	    answers[claimantType].noRecourseToPublicFunds = noRecourseToPublicFunds;

	    // Stamped visa
	    if (noRecourseToPublicFunds === 'yes') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.noRecourseToPublicFunds.id}?${claimantType}`);
	    }

	    // No stamped visa
	    else if (noRecourseToPublicFunds === 'no') {
	      res.redirect(`${appRoot}/questions/family-member?${claimantType}`);
	    }

	    else if (res.locals.currentApp.isPartnerFlow && noRecourseToPublicFunds === 'unknown') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    }
	  }

	  else {
	    res.render(`${appRootRel}/questions/no-recourse-to-public-funds`);
	  }
	});

	// ####################################################################
	// Checking if claimant has a family member visa
	// ####################################################################

	router.all(`${appRoot}/questions/family-member`, function (req, res) {
	  var familyMember = req.body.familyMember;
	  var answers = req.session[config.slug].answers;
	  var claimantType = res.locals.currentApp.claimantType;

	  if (familyMember) {
	    answers[claimantType].familyMember = familyMember;

	    // Visa says 'family member'
	    if (familyMember === 'yes') {
				if(!!answers.claimant.outcomeID){
	      res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    	}

				else {answers.claimant.isDerivedRightsFlow = true;
	        answers.claimant.outcomeId = outcomes.ineligible.id;
	        res.redirect(`${appRoot}/questions/partner?${claimantType}`);
	      }
			}

	    // Visa doesn't say 'family member'
	    else if (familyMember === 'no') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.leaveToRemain.id}?${claimantType}`);
	    }

	    else if (res.locals.currentApp.isPartnerFlow && familyMember === 'unknown') {
	      res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
	    }
	  }

	  else {
	    res.render(`${appRootRel}/questions/family-member`);
	  }
	});

  // ####################################################################
  // PYCA-613 Changes
  // ####################################################################

  router.all(`${appRoot}/questions/when-did-they-start-self-employment`, function (req, res) {
		var ukDay = req.body.ukDay;
		var ukMonth = req.body.ukMonth;
		var ukYear = req.body.ukYear;
		var dateSelfEmployment = req.body.ukDay + "/" + req.body.ukMonth + "/" + req.body.ukYear;
	  var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (ukDay && ukMonth && ukYear) {
			answers[claimantType].ukDay = ukDay;
			answers[claimantType].ukMonth = ukMonth;
			answers[claimantType].ukYear = ukYear;
			res.redirect(`${appRoot}/questions/self-employed-hours-worked?${claimantType}`);
		}
		else {
			res.render(`${appRootRel}/questions/when-did-they-start-self-employment`);
		}
  });

	router.all(`${appRoot}/questions/self-employed-hours-worked`, function (req, res) {
		var selfEmployedHours = req.body.selfEmployedHours;
	  var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (selfEmployedHours) {
			answers[claimantType].selfEmployedHours = selfEmployedHours;
			res.redirect(`${appRoot}/questions/monthly-average-earnings?${claimantType}`);
		}
		else {
			res.render(`${appRootRel}/questions/self-employed-hours-worked`);
		}
  });

	router.all(`${appRoot}/questions/monthly-average-earnings`, function (req, res) {
		var monthlyAverageEarnings = req.body.monthlyAverageEarnings;
	  var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (monthlyAverageEarnings) {
			answers[claimantType].monthlyAverageEarnings = monthlyAverageEarnings;
			res.redirect(`${appRoot}/questions/salary?${claimantType}`);
		}
		else {
			res.render(`${appRootRel}/questions/monthly-average-earnings`);
		}
  });

	router.all(`${appRoot}/questions/salary`, function (req, res) {
		var payThemselfASalary = req.body.payThemselfASalary;
	  var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (payThemselfASalary) {
			answers[claimantType].payThemselfASalary = payThemselfASalary;

			if (payThemselfASalary === 'yes')
			{
				res.redirect(`${appRoot}/outcomes/${outcomes.employedEEA.id}?${claimantType}`);
			} else {
				res.redirect(`${appRoot}/questions/ni-contributions?${claimantType}`);
			}
		}
		else {
			res.render(`${appRootRel}/questions/salary`);
		}
  });

	router.all(`${appRoot}/questions/ni-contributions`, function (req, res) {
		var niContributions = req.body.niContributions;
	  var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (niContributions) {
			answers[claimantType].niContributions = niContributions;
			res.redirect(`${appRoot}/questions/tax-return?${claimantType}`);
		}
		else {
			res.render(`${appRootRel}/questions/ni-contributions`);
		}
  });

	router.all(`${appRoot}/questions/tax-return`, function (req, res) {
		var taxReturnUkDay = req.body.ukDay;
		var taxReturnUkMonth = req.body.ukMonth;
		var taxReturnUkYear = req.body.ukYear;
		var dateSelfEmployment = req.body.ukDay + "/" + req.body.ukMonth + "/" + req.body.ukYear;
		var taxReturn = req.body.taxReturn;
	  var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if ((taxReturnUkDay && taxReturnUkMonth && taxReturnUkYear) || taxReturn) {
			answers[claimantType].ukDay = taxReturnUkDay;
			answers[claimantType].ukMonth = taxReturnUkMonth;
			answers[claimantType].ukYear = taxReturnUkYear;
			answers[claimantType].taxReturn = taxReturn;
			res.redirect(`${appRoot}/questions/accident-sick-pay?${claimantType}`);
		}
		else {
			res.render(`${appRootRel}/questions/tax-return`);
		}
  });

	router.all(`${appRoot}/questions/accident-sick-pay`, function (req, res) {
		var sickPay = req.body.sickPay;
		var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (sickPay) {
			answers[claimantType].sickPay = sickPay;

			if (sickPay === 'yes')
			{
				res.redirect(`${appRoot}/outcomes/${outcomes.employedEEA.id}?${claimantType}`);
			} else {
				res.redirect(`${appRoot}/questions/any-employees?${claimantType}`);
			}
		}
		else {
			res.render(`${appRootRel}/questions/accident-sick-pay`);
		}
	});

	router.all(`${appRoot}/questions/any-employees`, function (req, res) {
		var anyEmployees = req.body.anyEmployees;
		var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (anyEmployees) {
			answers[claimantType].anyEmployees = anyEmployees;
			res.redirect(`${appRoot}/questions/decide-who-provide-service-to?${claimantType}`);
		}
		else {
			res.render(`${appRootRel}/questions/any-employees`);
		}
	});

	router.all(`${appRoot}/questions/decide-who-provide-service-to`, function (req, res) {
		var decideWhoToProvideServiceTo = req.body.decideWhoToProvideServiceTo;
		var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (decideWhoToProvideServiceTo) {
			answers[claimantType].decideWhoToProvideServiceTo = decideWhoToProvideServiceTo;

			if (decideWhoToProvideServiceTo === 'yes')
			{
				res.redirect(`${appRoot}/questions/business-profit?${claimantType}`);
			} else {

				res.redirect(`${appRoot}/outcomes/${outcomes.employedEEA.id}?${claimantType}`);
			}
		}
		else {
			res.render(`${appRootRel}/questions/decide-who-provide-service-to`);
		}
	});

	router.all(`${appRoot}/questions/business-profit`, function (req, res) {
		var businessEverMadeProfit = req.body.businessEverMadeProfit;
		var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (businessEverMadeProfit) {
			answers[claimantType].businessEverMadeProfit = businessEverMadeProfit;
			res.redirect(`${appRoot}/questions/previous-self-employment?${claimantType}`);
		}
		else {
			res.render(`${appRootRel}/questions/business-profit`);
		}
	});

	router.all(`${appRoot}/questions/previous-self-employment`, function (req, res) {
		var previouslySelfEmployed = req.body.previouslySelfEmployed;
		var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (previouslySelfEmployed) {
			answers[claimantType].previouslySelfEmployed = previouslySelfEmployed;

			res.redirect(`${appRoot}/questions/when-did-they-arrive?${claimantType}`);
			// if (previouslySelfEmployed === 'yes')
			// {
			// 	res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
			// } else {
			// 	// res.redirect(`${appRoot}/questions/ni-contributions?${claimantType}`);
			// 	res.send("This is the new outcome page which is actually a question and asks for some ID and if they've got it today");
			// }
		}
		else {
			res.render(`${appRootRel}/questions/previous-self-employment`);
		}
	});

	router.all(`${appRoot}/questions/when-did-they-arrive`, function (req, res) {
		var arriveInUkDay = req.body.ukDay;
		var arriveInUkMonth = req.body.ukMonth;
		var arriveInUkYear = req.body.ukYear;
		var dateArrivedInUk = req.body.ukDay + "/" + req.body.ukMonth + "/" + req.body.ukYear;
		var answers = req.session[config.slug].answers;
		var claimantType = res.locals.currentApp.claimantType;

		if (arriveInUkDay && arriveInUkMonth && arriveInUkYear) {
			answers[claimantType].arriveInUkDay = arriveInUkDay;
			answers[claimantType].arriveInUkMonth = arriveInUkMonth;
			answers[claimantType].arriveInUkYear = arriveInUkYear;
			answers[claimantType].dateArrivedInUk = dateArrivedInUk;

			if (answers[claimantType].previouslySelfEmployed == 'yes') {
				res.redirect(`${appRoot}/outcomes/${outcomes.ineligible.id}?${claimantType}`);
			}
			else {
				// res.redirect(`${appRoot}/questions/ni-contributions?${claimantType}`);
				res.send("This is the new outcome page which is actually a question and asks for some ID and if they've got it today");
			}
			res.redirect(`${appRoot}/questions/accident-sick-pay?${claimantType}`);
		}
		else {
			res.render(`${appRootRel}/questions/when-did-they-arrive`);
		}
	});
  // ################ END PYCA-613 Changes ##############################

  return router

}