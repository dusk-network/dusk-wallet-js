module.exports = {
	"env": {
		"browser": true,
		"es2022": true,
		"node": true
	},
	"extends": [
		"@dusk-network/eslint-config/js"
	],
	"overrides": [{
		"files": ["*.spec.js", "*.test.js"],
		"rules": {
			"brace-style": [
				"error",
				"1tbs",
				{ "allowSingleLine": true }
			],
			"jsdoc/require-jsdoc": 0,
			"max-len": [
				"error", {
					"code": 110,
					"comments": 110,
					"ignorePattern": "^\\s*it\\(",
					"ignoreUrls": true
				}
			],
			"max-nested-callbacks": [
				"error",
				5
			],
			"max-statements": 0,
			"max-statements-per-line": [
				"error", {
					"max": 2
				}
			],
			"object-curly-newline": 0,
			"quote-props": [
				"error",
				"consistent"
			],
			"sort-keys": 0
		}
	}],
	"plugins": ["jsdoc"],
	"root": true,
	"settings": {
		"jsdoc": {
			"preferredTypes": {
				"array": "Array",
				"boolean": "Boolean",
				"date": "Date",
				"error": "Error",
				"function": "Function",
				"number": "Number",
				"object": "Object",
				"regexp": "RegExp",
				"string": "String",
				"undefined": "Undefined"
			},
			"tagNamePreference": {
				"arg": "param",
				"argument": "param",
				"augments": "extends",
				"file": "overview",
				"return": "returns"
			}
		}
	},
	"rules": {
		"jsdoc/check-alignment": 2,
		"jsdoc/check-examples": 0,
		"jsdoc/check-indentation": 0,
		"jsdoc/check-param-names": 2,
		"jsdoc/check-syntax": 2,
		"jsdoc/check-tag-names": 2,
		"jsdoc/check-types": 2,
		"jsdoc/implements-on-classes": 0,
		"jsdoc/match-description": 0,
		"jsdoc/newline-after-description": 0,
		"jsdoc/no-types": 0,
		"jsdoc/no-undefined-types": [
			"error", {
				"definedTypes": ["Any", "ArrayLike", "ListIteratorCallback"]
			}
		],
		"jsdoc/require-description": 0,
		"jsdoc/require-description-complete-sentence": 0,
		"jsdoc/require-example": 0,
		"jsdoc/require-hyphen-before-param-description": 0,
		"jsdoc/require-jsdoc": [
			"error", {
				"enableFixer": false,
				"require": {
					"ArrowFunctionExpression": true,
					"ClassDeclaration": true,
					"ClassExpression": true,
					"FunctionDeclaration": true,
					"FunctionExpression": true,
					"MethodDefinition": true
				}
			}
		],
		"jsdoc/require-param": 2,
		"jsdoc/require-param-description": 0,
		"jsdoc/require-param-name": 2,
		"jsdoc/require-param-type": 2,
		"jsdoc/require-returns": 2,
		"jsdoc/require-returns-check": 2,
		"jsdoc/require-returns-description": 0,
		"jsdoc/require-returns-type": 2,
		"jsdoc/valid-types": 0
	}
};
