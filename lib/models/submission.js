var _ = require('underscore');
var async = require('async');
var mongoose = require('mongoose');

var validators = require('./validators');
var validEmail = validators.validEmail;
var safeUrl = validators.safeUrl;
var validMediaType = validators.validMediaType;
var Mentor = require('./mentor');

var reviewSchema = new mongoose.Schema({
  date: {type: Date, default: Date.now},
  author: {type: String, required: true, validate: validEmail},
  response: {type: String, required: true},
  satisfiedRubrics: [Number]
});

var submissionSchema = new mongoose.Schema({
  learner: {type: String, required: true, validate: validEmail},
  criteriaUrl: {type: String, required: true, validate: safeUrl},
  achievement: {
    name: String,
    description: String,
    imageUrl: {type: String, validate: safeUrl}
  },
  cannedResponses: [String],
  // TODO: Ensure that at least one non-empty classification exists.
  classifications: [String],
  evidence: [
    {
      url: {type: String, validate: safeUrl},
      mediaType: {type: String, default: "link", validate: validMediaType},
      reflection: String
    }
  ],
  flagged: {type: Boolean, default: false},
  onChangeUrl: {type: String, validate: safeUrl},
  creationDate: {type: Date, default: Date.now},
  // TODO: Ensure that at least one rubric is required.
  rubric: {
    items: [
      {
        required: Boolean,
        text: String
      }
    ]
  },
  reviews: [reviewSchema],
});

reviewSchema.pre('save', function(next) {
  var parent = this.ownerDocument();
  var err;
  
  if (parent.cannedResponses.length) {
    if (parent.cannedResponses.indexOf(this.response) == -1) {
      err = new Error("review response is not in list of canned responses");
      err.name = "ValidationError";
      err.errors = {response: {message: err.message}};
      return next(err);
    }
  }
  next(null);
});

reviewSchema.pre('save', function(next) {
  var parent = this.ownerDocument();
  var self = this;

  Mentor.classificationsFor(self.author, function(err, classifications) {
    if (err)
      return next(err);
    if (_.intersection(classifications, parent.classifications).length)
      return next();
    err = new Error("reviewer " + self.author + " does not have " +
                    "permission to review");
    err.name = "ValidationError";
    err.errors = {reviewer: {message: err.message}};
    next(err);
  });
});

submissionSchema.methods.latestReview = function() {
  return this.reviews[this.reviews.length-1];
};

submissionSchema.methods.isReviewed = function() {
  return !!this.reviews.length || this.flagged;
};

submissionSchema.methods.isAwarded = function() {
  if (!this.reviews.length)
    return false;
  var satisfied = this.latestReview().satisfiedRubrics;
  var result = true;
  this.rubric.items.forEach(function(item, i) {
    if (item.required && satisfied.indexOf(i) == -1)
      result = false;
  }, this);
  return result;
};

submissionSchema.methods.canBeReviewedBy = function(email, cb) {
  var self = this;

  async.waterfall([
    Mentor.classificationsFor.bind(Mentor, email),
    function(classifications, done) {
      if (_.intersection(classifications, self.classifications).length)
        return done(null, true);
      return done(null, false);
    }
  ], cb);
};

submissionSchema.methods.isLearnerUnderage = function() {
  return !!this.cannedResponses.length;
};

var Submission = mongoose.model('Submission', submissionSchema);

function findSubmissions(options, cb) {
  async.waterfall([
    Mentor.classificationsFor.bind(Mentor, options.email),
    function(classifications, done) {
      options.criteria.classifications = {$in: classifications};
      Submission.paginate({
        criteria: options.criteria,
        options: options.options,
        page: options.page,
        resultsPerPage: options.resultsPerPage
      }, done);
    }
  ], cb);
}

Submission.findReviewed = function(options, cb) {
  findSubmissions({
    criteria: {
      $or: [
        {reviews: {$not: {$size: 0}}},
        {flagged: true}
      ]
    },
    options: {sort: '-creationDate'},
    email: options.email,
    page: options.page,
    resultsPerPage: options.resultsPerPage
  }, cb);
};

Submission.findForReview = function(options, cb) {
  findSubmissions({
    criteria: {
      $and: [
        {reviews: {$size: 0}},
        {flagged: false}
      ]
    },
    options: {sort: 'creationDate'},
    email: options.email,
    page: options.page,
    resultsPerPage: options.resultsPerPage
  }, cb);
};

module.exports = Submission;

// This is only here so tests can mock/test things out.
Submission.Mentor = Mentor;
