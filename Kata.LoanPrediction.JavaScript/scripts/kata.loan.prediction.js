var kataLoanPredictionApp = function() {

    ///////////////////////////////////////////////////////
    // models
    var kataLoanPredictionModels = function() {

        function loanContext() {
            this.startDate = null;
            this.targetEndDate = null;
            this.balance = 0.0;
            this.interestRate = 0.0;
            this.minRepaymentAmount = 0.0;
            this.minRepaymentDay = 0;
            this.extraRepaymentAmount = 0.0;
            this.extraRepaymentDay = 0;
        }

        function loanTransaction() {
            this.date = null;
            this.type = null;
            this.credit = 0.0;
            this.debit = 0.0;
            this.balance = 0.0;
        }

        function loanCalculationOutput() {
            this.transactions = [];
            this.interestStartDate = null;
            this.loanEndsDate = null;
            this.totalInterestPaid = null;
            this.targetEndDateHit = false;
            this.targetEndDateMissedInDays = 0;
        }

        return ({
            loanContext: loanContext,
            loanTransaction: loanTransaction,
            loanCalculationOutput: loanCalculationOutput
        });
    }();

    ///////////////////////////////////////////////////////
    // constants
    var kataLoanPredictionConstants = function() {

        var constants = {
            NUM_DAYS_IN_YEAR: 365,
            NUM_MS_IN_A_DAY: 1000 * 60 * 60 * 24
        };

        return ({
            get: function(constantName) {
                return (constants[constantName]);
            }
        });
    }();

    ///////////////////////////////////////////////////////
    // enums
    var kataLoanPredicitionEnums = function() {

        var transactionTypes = {
            minimumRepayment: {
                code: 100,
                description: "Minimum Repayment"
            },
            extraRepayment: {
                code: 101,
                description: "Extra Repayment"
            },
            interestCharged: {
                code: 102,
                description: "Interest Charged"
            },
            finalRepayment: {
                code: 103,
                description: "Final Repayment"
            }
        };

        return ({
            transactionTypes: transactionTypes
        });
    }();

    ///////////////////////////////////////////////////////
    // calculator
    var kataLoanPredictionCalculator = function() {
        function processEndOfMonth(currentDate, monthlyInterest, balance, result) {
            // add interest charged transaction
            balance += monthlyInterest;
            // calculate the total interest paid
            result.totalInterestPaid += monthlyInterest;
            var transaction = new kataLoanPredictionModels.loanTransaction();
            transaction.date = currentDate;
            transaction.type = kataLoanPredicitionEnums.transactionTypes.interestCharged;
            transaction.debit = monthlyInterest;
            transaction.balance = balance;
            result.transactions.push(transaction);
            return (balance);
        }

        function processExtraRepayment(balance, extraRepaymentAmount, currentDate, result) {
            if (balance >= extraRepaymentAmount) {
                // add extra repay transaction (if amount is more than 0)
                balance -= extraRepaymentAmount;
                var transaction = new kataLoanPredictionModels.loanTransaction();
                transaction.date = currentDate;
                transaction.type = kataLoanPredicitionEnums.transactionTypes.extraRepayment;
                transaction.credit = extraRepaymentAmount;
                transaction.balance = balance;
                result.transactions.push(transaction);
            }
            return (balance);
        }

        function processMinRepayment(balance, minRepaymentAmount, currentDate, monthlyInterest, result) {
            var transaction = null;
            // add min repay transaction
            if ((balance + monthlyInterest) <= minRepaymentAmount) {
                var finalRepayment = 0.0;
                balance += monthlyInterest;
                finalRepayment = balance;
                balance -= finalRepayment;
                transaction = new kataLoanPredictionModels.loanTransaction();
                transaction.date = currentDate;
                transaction.type = kataLoanPredicitionEnums.transactionTypes.finalRepayment;
                transaction.credit = finalRepayment;
                transaction.balance = balance;
                result.transactions.push(transaction);
            } else {
                balance -= minRepaymentAmount;
                transaction = new kataLoanPredictionModels.loanTransaction();
                transaction.date = currentDate;
                transaction.type = kataLoanPredicitionEnums.transactionTypes.minimumRepayment;
                transaction.credit = minRepaymentAmount;
                transaction.balance = balance;
                result.transactions.push(transaction);
            }
            return (balance);
        }

        function calculateDailyInterest(balance, interestRate) {
            //console.log("Calculate daily interest. Num days in year: " + kataLoanPredictionConstants.get("NUM_DAYS_IN_YEAR"));
            var result = 0.0;
            result = (balance * (interestRate / 100)) / kataLoanPredictionConstants.get("NUM_DAYS_IN_YEAR");
            //console.log("Calculate daily interest result: " + result);
            return (result);
        }

        function setTargetEndDateAccuracy(actualEndDate, targetEndDate, result) {
            var utc1 = Date.UTC(actualEndDate.getFullYear(), actualEndDate.getMonth(), actualEndDate.getDate());
            var utc2 = Date.UTC(targetEndDate.getFullYear(), targetEndDate.getMonth(), targetEndDate.getDate());
            var days = Math.floor((utc2 - utc1) / kataLoanPredictionConstants.get("NUM_MS_IN_A_DAY"));
            if (days == 0) result.targetEndDateHit = true;
            result.targetEndDateMissedInDays = Math.abs(days);
        }

        var calculate = function(context) {
            //console.log("Calculate starting");
            var result = new kataLoanPredictionModels.loanCalculationOutput();
            var firstIteration = true;
            var balance = context.balance;
            var monthlyInterest = 0.0;
            var currentDate = context.startDate;
            // we will calculate interest from the first of the month
            var calcInterestStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            var done = false;
            result.interestStartDate = calcInterestStartDate;
            // loop through dates, caculating interest daily etc
            while (!done) {
                //console.log("Looping - while(true) here");
                // if min repay day
                if (currentDate.getDate() == context.minRepaymentDay && balance > 0.0) {
                    balance = processMinRepayment(balance, context.minRepaymentAmount, currentDate, monthlyInterest, result);
                }
                // if extra repay day
                if (currentDate.getDate() == context.extraRepaymentDay && context.extraRepaymentAmount > 0.0 && balance > 0.0) {
                    balance = processExtraRepayment(balance, context.extraRepaymentAmount, currentDate, result);
                }

                // if balance is zero or less - we are done!
                if (balance <= 0.0) {
                    //console.log("Loan ends on " + currentDate + ". Should break out of loop now.");
                    result.loanEndsDate = currentDate;
                    done = true;
                    continue;
                }
                // calculate the daily interest
                monthlyInterest += calculateDailyInterest(balance, context.interestRate);
                //console.log("Monthly interest at: " + monthlyInterest);
                // if this is the first iteration and we did not start on the first of the month
                // let's calculate the interest for the days back to the first
                if (firstIteration && context.startDate.getDate() != 1) {
                    var daysToMonthStart = currentDate.getDate() - 1;
                    monthlyInterest += (monthlyInterest * daysToMonthStart);
                    firstIteration = false;
                }
                // move date forward
                var nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
                // if end of month
                if (currentDate.getMonth() != nextDate.getMonth()) {
                    balance = processEndOfMonth(currentDate, monthlyInterest, balance, result);
                    // reset interest to zero
                    monthlyInterest = 0.0;
                }
                //console.log("Moving to next date: " + nextDate + " balance is: " + balance);
                currentDate = nextDate;
            }
            setTargetEndDateAccuracy(result.loanEndsDate, context.targetEndDate, result);
            return (result);
        };

        return ({
            calculate: calculate
        });
    }();

    ///////////////////////////////////////////////////////
    // returns public interface to the app
    return ({
        calculator: kataLoanPredictionCalculator,
        models: kataLoanPredictionModels,
        constants: kataLoanPredictionConstants,
        enums: kataLoanPredicitionEnums
    });
}();

/*
var context = new kataLoanPredictionApp.models.loanContext();
context.balance = 30000.00;
context.interestRate = 5.25;
context.minRepaymentAmount = 1500.00;
context.minRepaymentDay = 1;
context.extraRepaymentAmount = 1000.00;
context.extraRepaymentDay = 18;
context.startDate = new Date(2007, 03, 01);
context.targetEndDate = new Date(2010, 10, 01);
console.log(context);
                
var output = kataLoanPredictionApp.calculator.calculate(context);
console.log(output);
 */