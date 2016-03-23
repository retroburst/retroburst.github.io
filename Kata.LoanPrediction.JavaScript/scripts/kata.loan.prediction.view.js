var kataLoanPredictionView = function() {        
    var db = new Nedb({ filename: 'Kata.LoanPrediction.JavaScript.store', autoload: true });
    var templates = null;
    var validateConstraints = null;
    var defaultLoanContextSettings = {
        startDate : moment(),
        targetEndDate : moment().add(25, 'year'),
        balance : 250000,
        interestRate : 5.00,
        minRepaymentAmount : 2000,
        minRepaymentDay : 1,
        extraRepaymentAmount : 1000,
        extraRepaymentDay : 20
    };
    
    ///////////////////////////////////////////////////////
    // constants
    var kataLoanPredictionViewConstants = function() {
        var constants = {
            DATE_FORMAT : "DD/MM/YYYY"
        };
        
        return ({
            get: function(constantName) {
                return (constants[constantName]);
            }
        });
    }();
    
    var joinErrorMessages = function(messages){
        messages = messages || [];
        var result = messages.join('. ');
        if(!S(result).endsWith('.')){
            result += '.';
        }
        return(result);
    };
    
    var showValidationErros = function showValidationErros(errors){
        errors = errors || {};
        for (var property in errors) {
            if (errors.hasOwnProperty(property)) {
                var input = $('#' + property);
                if(input){
                    var group = input.closest('.form-group');
                    if(group){
                        group.addClass('has-error');
                        group.find('.validation-message').text(joinErrorMessages(errors[property]));
                    }
                }
            }
        }
    };
    
    var clearValidationErrors = function clearValidationErrors(){
        $('.validation-message').empty();
        $('.form-group').removeClass('has-error');
    };
    
    var initHandlebars = function initHandlebars(){
        Handlebars.registerHelper('formatDate', function(date) {
            var dateAsMoment = date;
            if(date instanceof Date){
                dateAsMoment = moment(date);
            }
            if(dateAsMoment instanceof moment){
                return(moment(date).format(kataLoanPredictionViewConstants.get("DATE_FORMAT")));
            }
        });
        
        Handlebars.registerHelper('formatMoney', function(amount) {
            if(!isNaN(amount)){
                return(accounting.formatMoney(amount));
            }
        });
        
        Handlebars.registerHelper('formatMoneyShort', function(amount) {
            if(!isNaN(amount)){
                return(accounting.formatMoney(amount, { precision: 0 }));
            }
        });
        
        Handlebars.registerHelper('formatDecimal', function(target) {
            if(!isNaN(target)){
                return(target.toFixed(2));
            }
        });
        
        Handlebars.registerHelper('isAroundTargetEndDate',function isAroundTargetEndDate(transDate, targetEndDate){
            var transDateAsMoment = moment(transDate);
            var targetEndDateAsMoment = moment(targetEndDate);
            if(transDateAsMoment.month() == targetEndDateAsMoment.month()
                && transDateAsMoment.year() == targetEndDateAsMoment.year()){
                return(true);
            } else {
                return(false);
            }
        });

        Handlebars.registerHelper('formatDateForComboDate', function(date) {
            var dateAsMoment = date;
            if(date instanceof Date){
                dateAsMoment = moment(date);
            }
            if(dateAsMoment instanceof moment){
                return(dateAsMoment.format(kataLoanPredictionViewConstants.get("DATE_FORMAT")));
            }
        });
        
        Handlebars.registerHelper('safeValue', function(target, safeValue) {
            if(target){
                return(target);
            } else {
                return(safeValue);
            }
        });

        var templates = {
            inputFormTemplate : Handlebars.compile($("#input-form-template").html()),
            resultsTemplate : Handlebars.compile($("#results-template").html())
        };
        return(templates);
    };
    
    var buildAttributes = function buildAttributes(){
        var attributes = {};
        attributes.balance = $('#balance').val();
        attributes.interestRate = $('#interestRate').val();
        attributes.minRepaymentAmount = $('#minRepaymentAmount').val();
        attributes.minRepaymentDay = $('#minRepaymentDay').val();
        attributes.extraRepaymentAmount = $('#extraRepaymentAmount').val();
        attributes.extraRepaymentDay = $('#extraRepaymentDay').val();
        attributes.startDate = $('#startDate').val();
        attributes.targetEndDate = $('#targetEndDate').val();
        return(attributes);
    };
    
    var storeLoanContextInDatabase = function storeLoanContextInDatabase(loanContext, callback){
        db.find({}, function (err, docs) {
            if(err){
                log.error(err);
                if(callback) callback(loanContext);
            } else if(docs.length > 0){
                db.update({}, loanContext, {}, function (err, numReplaced) {
                    if(err) {
                        log.error(err);
                    }
                    if(callback) callback(loanContext);
                });
            } else {
                db.insert(loanContext, function (err) {
                    if(err) {
                        log.error(err);
                    }
                    if(callback) callback(loanContext);
                });
            }
        });
    };
    
    var retrieveLoanContextFromDatabase = function retrieveLoanContextFromDatabase(callback){
        db.find({}, function (err, docs) {
            if(docs.length > 0){
                if(callback) callback(docs[0]);
            } else {
                if(err) {
                    log.error(err);
                }
                if(callback) callback(null);
            }
        });
    };
    
    var buildLoanContextFromInput = function buildLoanContextFromInput(callback){
        var context = new kataLoanPredictionCommon.models.loanContext();
        context.balance = parseFloat($('#balance').val());
        context.interestRate = parseFloat($('#interestRate').val());
        context.minRepaymentAmount = parseFloat($('#minRepaymentAmount').val());
        context.minRepaymentDay = parseInt($('#minRepaymentDay').val());
        context.extraRepaymentAmount = parseFloat($('#extraRepaymentAmount').val());
        context.extraRepaymentDay = parseInt($('#extraRepaymentDay').val());
        context.startDate = moment($('#startDate').val(), kataLoanPredictionViewConstants.get("DATE_FORMAT")).toDate();
        context.targetEndDate = moment($('#targetEndDate').val(), kataLoanPredictionViewConstants.get("DATE_FORMAT")).toDate();
        // stores the context for later use by input form
        storeLoanContextInDatabase(context, callback);
    };
    
    // init form
    var initInputForm = function initInputForm(storedLoanContextSettings){
        var initialSettings =  storedLoanContextSettings || defaultLoanContextSettings;
        if(!initialSettings.currencySymbol){
            initialSettings.currencySymbol = accounting.settings.currency.symbol;
        }
        // intial view setup
        $('#inputContainer').show();
        $('#resultsContainer').hide();
        $('#inputFormContainer').empty();
        $('#inputFormContainer').append(templates.inputFormTemplate(initialSettings));
        
        $('#calculateButton').click(function(e){
            clearValidationErrors();
            var attributes = buildAttributes();
            var errors = validate(attributes, validateConstraints);
            if(!errors){
                buildLoanContextFromInput(initResults);
            } else {
                showValidationErros(errors);
            }
        });
        
        $('#resetDefault').click(function(e){
            initInputForm(defaultLoanContextSettings);
            $('#startDate').focus();
            $("html, body").animate({ scrollTop: 0 }, "slow");
        });
        
        $('.combodate').combodate(
        {
            minYear: 1975,
            maxYear: 2050,
            customClass: 'form-control combodate-inline',
            format: kataLoanPredictionViewConstants.get("DATE_FORMAT")
        });
    };
    
    var initResults = function initResults(context){
        // calculate the loan
        var output = kataLoanPredictionCommon.calculator.calculate(context);
        // clear table
        $('#resultsContainer').empty();
        $('#resultsContainer').append(templates.resultsTemplate({ context : context, output : output }));
        // show results
        // hide input
        $('#resultsContainer').show();
        $('#inputContainer').hide();
        
        $('.start-over-button').click(function(e){
            retrieveLoanContextFromDatabase(initInputForm);
        });
        
        $("html, body").animate({ scrollTop: 0 }, "slow");
    };
    
    var initValidate = function initValidate(){
        // Before using it we must add the parse and format functions
        // Here is a sample implementation using moment.js
        validate.extend(validate.validators.datetime, {
            // The value is guaranteed not to be null or undefined but otherwise it
            // could be anything.
            parse: function(value, options) {
                return +moment.utc(value, kataLoanPredictionViewConstants.get("DATE_FORMAT"));
            },
            // Input is a unix timestamp
            format: function(value, options) {
                var format = options.dateOnly ? kataLoanPredictionViewConstants.get("DATE_FORMAT") : kataLoanPredictionViewConstants.get("DATE_FORMAT") + " hh:mm:ss";
                return moment.utc(value).format(format);
            }
        });
        
        // These are the constraints used to validate the form
        var constraints = {
            startDate: function(value, attributes, attributeName, options, constraints) {
                var subConstraints = {
                    presence: true,
                    datetime: {
                        dateOnly: true,
                        latest: attributes.targetEndDate,
                        message: 'Start Date must not be after the Target End Date.'
                    }
                };
                return(subConstraints);
            },
            targetEndDate: function(value, attributes, attributeName, options, constraints) {
                var subConstraints = {
                    presence: true,
                    datetime: {
                        dateOnly: true,
                        earliest: attributes.startDate,
                        message: 'Target End Date must not be before the Start Date.'
                    }
                };
                return(subConstraints);
            },
            balance: {
                presence: true,
                numericality: {
                    onlyInteger: false,
                    greaterThan: 0
                }
            },
            interestRate: {
                presence: true,
                numericality: {
                    onlyInteger: false,
                    greaterThan: 0
                }
            },
            minRepaymentAmount: {
                presence: true,
                numericality: {
                    onlyInteger: false,
                    greaterThan: 0
                }
            },
            minRepaymentDay: {
                presence: true,
                numericality: {
                    onlyInteger: true,
                    greaterThan: 0
                }
            },
            extraRepaymentAmount: function(value, attributes, attributeName, options, constraints) {
                var subConstraints =
                {
                    presence: false,
                    numericality: {
                        onlyInteger: true,
                        greaterThan: 0
                    }
                };
                if(attributes.extraRepaymentDay){
                    subConstraints.presence = true;
                }
                return(subConstraints);
            },
            extraRepaymentDay: function(value, attributes, attributeName, options, constraints) {
                var subConstraints =
                {
                    presence: false,
                    numericality: {
                        onlyInteger: true,
                        greaterThan: 0
                    }
                };
                if(attributes.extraRepaymentAmount){
                    subConstraints.presence = true;
                }
                return(subConstraints);
            }
        };
        return(constraints);
    };

    var initView = function initVew(){
        // init handlebars
        templates = initHandlebars();
        validateConstraints = initValidate();
        retrieveLoanContextFromDatabase(initInputForm);
    };
    
    ///////////////////////////////////////////////////////
    // returns public interface
    return ({
        initView : initView
    });
}();