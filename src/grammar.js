"use strict";

var Context = require("context.js");
var Lexer = require("js/Lexer.js");
var Parser = require("parser.js");
var Class = require("rtl.js").Class;

var literal = Parser.literal;
var digit = Lexer.digit;
var hexDigit = Lexer.hexDigit;
var point = Lexer.point;
var separator = Lexer.separator;

var and = Parser.and;
var or = Parser.or;
var optional = Parser.optional;
var repeat = Parser.repeat;

var context = Parser.context;
var emit = Parser.emit;
var required = Parser.required;

var reservedWords = "ARRAY IMPORT THEN BEGIN IN TO BY IS TRUE CASE MOD TYPE CONST MODULE UNTIL DIV NIL VAR DO OF WHILE ELSE OR ELSIF POINTER END PROCEDURE FALSE RECORD FOR REPEAT IF RETURN";

function make(makeDesignator,
              makeProcedureHeading, 
              makeProcedureDeclaration,
              makeFieldList,
              recordDeclContext,
              reservedWords
              ){
var result = {};

var ident = function(stream, context){
    return Lexer.ident(stream, context, reservedWords);
};

var qualident = context(and(optional(and(ident, ".")), ident),
                        Context.QualifiedIdentificator);
var identdef = context(and(ident, optional("*")),
                       Context.Identdef);

var selector = or(and(point, ident)
                // break recursive declaration of expList
                , and("[", function(stream, context){return expList(stream, context);}, "]")
                , "^"
                , context(and("(", qualident, ")"), Context.TypeCast)
                );
var designator = makeDesignator(qualident, selector);
var type = or(context(qualident, Context.Type),
              function(stream, context){return strucType(stream, context);} // break recursive declaration of strucType
             );
var identList = and(identdef, repeat(and(",", identdef)));
var variableDeclaration = context(and(identList, ":", type), Context.VariableDeclaration);

var integer = or(context(and(digit, repeat(hexDigit), "H", separator), Context.HexInteger)
               , context(and(digit, repeat(digit), separator), Context.Integer));

var scaleFactor = and(or("E", "D"), optional(or("+", "-")), digit, repeat(digit));
var real = context(and(digit, repeat(digit), point, repeat(digit), optional(scaleFactor))
                 , Context.Real);

var number = or(real, integer);

var string = or(context(Lexer.string, Context.String)
              , context(and(digit, repeat(hexDigit), "X"), Context.Char));

var factor = context(
    or(string, number, "NIL", "TRUE", "FALSE"
     , function(stream, context){return set(stream, context);} // break recursive declaration of set
     , context(and(designator
                 // break recursive declaration of actualParameters
                 , optional(function(stream, context){return actualParameters(stream, context);})
                  )
             , Context.ExpressionProcedureCall)
     , and("(", function(stream, context){return expression(stream, context);}
         , required(")", "no matched ')'"))
     , and("~", function(stream, context){
                    return factor(stream, context);}) // break recursive declaration of factor
     )
    , Context.Factor);

var addOperator = context(or("+", "-", "OR"), Context.AddOperator);
var mulOperator = context(or("*", "/", "DIV", "MOD", "&"), Context.MulOperator);
var term = context(and(factor, repeat(and(mulOperator, factor))), Context.Term);
var simpleExpression = context(
        and(optional(or("+", "-"))
          , term
          , repeat(and(addOperator, term)))
      , Context.SimpleExpression);
var relation = or("=", "#", "<=", "<", ">=", ">", "IN", "IS");
var expression = context(and(simpleExpression, optional(and(relation, simpleExpression)))
                       , Context.Expression);
var constExpression = expression;

var element = context(and(expression, optional(and("..", expression))), Context.SetElement);
var set = and("{", context(optional(and(element, repeat(and(",", element)))), Context.Set)
            , "}");

var expList = and(expression, repeat(and(",", expression)));
var actualParameters = and("(", context(optional(expList), Context.ActualParameters), ")");
var procedureCall = context(and(designator, optional(actualParameters))
                          , Context.StatementProcedureCall);

var assignment = context(and(designator, context(or(":=", "="), Context.CheckAssignment)
                       , required(expression, "expression expected"))
                       , Context.Assignment);

var statement = optional(or(
                   emit(assignment, Context.emitEndStatement)
                 , emit(procedureCall, Context.emitEndStatement)
                   // break recursive declaration of ifStatement/caseStatement/whileStatement/repeatStatement
                 , function(stream, context){return ifStatement(stream, context);}
                 , function(stream, context){return caseStatement(stream, context);}
                 , function(stream, context){return whileStatement(stream, context);}
                 , function(stream, context){return repeatStatement(stream, context);}
                 , function(stream, context){return forStatement(stream, context);}
                 ));
var statementSequence = and(statement, repeat(and(";", statement)));

var ifStatement = and("IF", context(expression, Context.If), required("THEN", "THEN expected"), statementSequence
                    , repeat(and("ELSIF", context(expression, Context.ElseIf), required("THEN", "THEN expected"), statementSequence))
                    , optional(and("ELSE", context(statementSequence, Context.Else)))
                    , emit("END", Context.emitIfEnd));

var label = or(integer, string, ident);
var labelRange = context(and(label, optional(and("..", label))), Context.CaseRange);
var caseLabelList = context(and(labelRange, repeat(and(",", labelRange))), Context.CaseLabelList);
var caseParser = optional(context(and(caseLabelList, ":", statementSequence), Context.CaseLabel));
var caseStatement = and("CASE", context(and(expression
                      , "OF", caseParser, repeat(and("|", caseParser)), "END")
                      , Context.Case));

var whileStatement = and("WHILE", context(expression, Context.While), "DO", statementSequence
                       , repeat(and("ELSIF", context(expression, Context.ElseIf), "DO", statementSequence))
                       , emit("END", Context.emitWhileEnd)
                       );
var repeatStatement = and("REPEAT", context(statementSequence, Context.Repeat)
                        , "UNTIL", context(expression, Context.Until));

var forStatement = context(and("FOR", ident, ":=", expression, "TO", expression
                             , optional(and("BY", constExpression))
                             , emit("DO", Context.emitForBegin)
                             , statementSequence, required("END", "END expected (FOR)"))
                         , Context.For);

var fieldList = makeFieldList(
        identdef,
        identList,
        type,
        function(stream, context){return formalParameters(stream, context);}
        );
var fieldListSequence = and(fieldList, repeat(and(";", fieldList)));

var arrayType = and("ARRAY", context(and(
                        context(and(constExpression, repeat(and(",", constExpression)))
                              , Context.ArrayDimensions)
                  , "OF", type), Context.ArrayDecl));

var baseType = context(qualident, Context.BaseType);
var recordType = and("RECORD", context(and(optional(and("(", baseType, ")")), optional(fieldListSequence)
                                     , "END"), recordDeclContext));

var pointerType = and("POINTER", "TO", context(type, Context.PointerDecl));

var formalType = context(and(repeat(and("ARRAY", "OF")), qualident), Context.FormalType);
var fpSection = and(optional(literal("VAR")), ident, repeat(and(",", ident)), ":", formalType);
var formalParameters = and(
          "("
        , optional(context(and(fpSection, repeat(and(";", fpSection))), Context.ProcParams))
        , required( ")" )
        , optional(and(":", qualident)));

var procedureType = and("PROCEDURE"
                      , context(optional(formalParameters), Context.FormalParameters)
                        );
var strucType = or(arrayType, recordType, pointerType, procedureType);
var typeDeclaration = context(and(identdef, "=", strucType), Context.TypeDeclaration);

var constantDeclaration = context(and(identdef, "=", constExpression), Context.ConstDecl);

var imprt = and(ident, optional(and(":=", ident)));
var importList = and("IMPORT", imprt, repeat(and(",", imprt)));

result.expression = expression;
result.statement = statement;
result.typeDeclaration = typeDeclaration;
result.variableDeclaration = variableDeclaration;
var procedureHeading = makeProcedureHeading(ident, identdef, formalParameters);
result.ident = ident;
result.procedureDeclaration
    // break recursive declaration of procedureBody
    = makeProcedureDeclaration(
        ident,
        procedureHeading,
        function(stream, context){
            return result.procedureBody(stream, context);}
    );
result.declarationSequence
    = and(optional(and("CONST", repeat(and(constantDeclaration, required(";"))))),
          optional(and("TYPE", context(repeat(and(typeDeclaration, required(";"))), Context.TypeSection))),
          optional(and("VAR", repeat(and(variableDeclaration, required(";"))))),
          repeat(and(result.procedureDeclaration, ";")));
result.procedureBody
    = and(result.declarationSequence,
          optional(and("BEGIN", statementSequence)),
          optional(context(and("RETURN", expression), Context.Return)),
          required("END", "END expected (PROCEDURE)"));
result.module
    = context(and("MODULE", ident, ";",
                  context(optional(and(importList, ";")), Context.ModuleImport),
                  result.declarationSequence,
                  optional(and("BEGIN", statementSequence)),
                  required("END", "END expected (MODULE)"), ident, point),
              Context.ModuleDeclaration);
return result;
}

exports.make = make;
exports.reservedWords = reservedWords;
