var Fs = require('fs-extra');
var Handlebars = require('handlebars');
var Path = require('path');
var Paths = require('../paths');
var Utils = require('../utils');

/*
  A wrapper for Handlebars
 */

// Creating a new instance of handlebars which will then be merged with the module
var handlebars = Handlebars.create();
// Keep original handlers since these methods are gonna be overriden
var superRegisterHelper = handlebars.registerHelper.bind(handlebars);
var superRegisterPartial = handlebars.registerPartial.bind(handlebars);
// Used to store registered transformations
var transformations = {};
// Cache for templates which were already compiled
var cache = {};


// Read the provided file, render it, and overwrite it. Use with caution!
function overwriteTemplateFile(templatePath, scope) {
  templatePath = resolveTemplatePath(templatePath);
  var view = renderTemplateFile(templatePath, scope);

  return Fs.writeFileSync(templatePath, view);
}

// Read provided file and render its template. Note that the default path would
// be tortilla's template dir, so specifying a file name would be ok as well
function renderTemplateFile(templatePath, scope) {
  templatePath = resolveTemplatePath(templatePath);

  if (process.env.TORTILLA_CACHE_DISABLED || !cache[templatePath]) {
    var templateContent = Fs.readFileSync(templatePath, 'utf8');
    cache[templatePath] = handlebars.compile(templateContent);
  }

  var template = cache[templatePath];
  return template(scope);
}

// Render provided template
function renderTemplate(template, scope) {
  return handlebars.compile(template)(scope);
}

// Returns a template path relative to tortilla with an '.md.tmpl' extension
function resolveTemplatePath(templatePath) {
  if (templatePath.indexOf('.md.tmpl') == -1) {
    templatePath += '.md.tmpl';
  }

  // User defined templates
  var relativeTemplatePath = Path.resolve(Paths.manuals.templates, templatePath);
  if (Utils.exists(relativeTemplatePath)) return relativeTemplatePath;

  // Tortilla defined templates
  return Path.resolve(Paths.tortilla.templates, templatePath);
}

// Register a new helper. Registered helpers will be wrapped with a
// [{]: <helper> (name ...args) [}]: #
function registerHelper(name, helper) {
  var wrappedHelper = function () {
    var out = helper.apply(this, arguments);

    if (typeof out != 'string') throw Error([
      'Template helper', name, 'must return a string!',
      'Instead it returned', out
    ].join(' '));

    var target = process.env.TORTILLA_RENDER_TARGET;
    var args = [].slice.call(arguments);

    // Transform helper output
    if (target) out = transformations[target][name].apply(null, [out].concat(args));
    out = wrapComponent('helper', name, args, out);

    return out;
  }

  return superRegisterHelper(name, wrappedHelper);
}

// Register a new partial. Registered partials will be wrapped with a
// [{]: <partial> (name) [}]: #
function registerPartial(name, partial) {
  partial = wrapComponent('partial', name, partial);

  return superRegisterPartial(name, partial);
}

// Register a new transformation which will take effect on rendered helpers. This is
// useful when setting the TORTILLA_RENDER_TARGET variable, so we can make additional
// adjustments for custom targets. For now this is NOT part of the official API and
// is used only for development purposes
function registerTransformation(targetName, helperName, transformation) {
  if (!transformations[targetName]) transformations[targetName] = {};
  transformations[targetName][helperName] = transformation;
}

// Returns content wrapped by component notations. Mostly useful if we want to detect
// components in the view later on using external softwares later on.
// e.g. https://github.com/Urigo/angular-meteor-docs/blob/master/src/app/tutorials/
// improve-code-resolver.ts#L24
function wrapComponent(type, name, args, content) {
  var hash = {};

  if (!content) {
    content = args;
    args = [];
  }

  if (args[args.length - 1] instanceof Object) {
    hash = args.pop().hash;
  }

  // Stringify arguments
  var params = args.map(function (param) {
    return typeof param == 'string' ? '"' + param + '"' : param;
  }).join(' ');

  hash = stringifyHash(hash);

  // Concat all stringified arguments
  args = [name, params, hash]
    // Get rid of empty strings
    .filter(Boolean)
    .join(' ');

  return [
    '[{]: <' + type + '> (' + args + ')', content, '[}]: #'
  ].join('\n');
}

// Takes a helper hash and stringifying it
// e.g. { foo: '1', bar: 2 } -> foo="1" bar=2
function stringifyHash(hash) {
  return Object.keys(hash).map(function (key) {
    var value = hash[key];
    if (typeof value == 'string') value = '"' + value +'"';
    return key + '=' + value;
  }).join(' ');
}


module.exports = Utils.extend(handlebars, {
  overwriteTemplateFile: overwriteTemplateFile,
  renderTemplateFile: renderTemplateFile,
  renderTemplate: renderTemplate,
  registerHelper: registerHelper,
  registerPartial: registerPartial,
  registerTransformation: registerTransformation
});

// Built-in helpers and partials
require('./diff-step-helper');
require('./nav-step-helper');
