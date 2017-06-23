const PREC = {
  DECLARATION: 1,
  ACCESSIBILITY: 1,
  UNION: 2,
  INTERSECTION: 2,
  PLUS: 4,
  REL: 5,
  TIMES: 6,
  TYPEOF: 7,
  NEG: 9,
  INC: 10,
  NON_NULL_ASSERTION_OP: 10,
  FUNCTION_CALL: 12,
  ARRAY_TYPE: 13,
  MEMBER: 13,
  AS_EXPRESSION: 14,
  TYPE_ASSERTION: 15
};

module.exports = grammar(require('tree-sitter-javascript/grammar'), {
  name: 'typescript',

  externals: $ => [
    $._automatic_semicolon
  ],

  conflicts: ($, previous) => previous.concat([

    // TODO - Figure out why these are needed.
    [$.required_parameter, $.assignment],
    [$.required_parameter, $._expression],
    [$.required_parameter, $._primary_type],

    [$.identifier, $.predefined_type],

    // ( foo ? )
    //       ^ expression or optional parameter?
    [$._expression, $.optional_parameter],

    // foo: "string"
    //      ^ expression or literal type?
    [$._expression, $.literal_type],

    [$.method_signature, $.method_definition, $._expression],

    [$._expression, $._type_member, $.method_signature],

    // parenthesized_type starting with object type or function type starting with a destructuring pattern?
    [$._expression, $._primary_type],

    [$._expression, $.required_parameter, $._primary_type],

    [$._expression, $.property_signature],

    [$._expression, $.property_signature, $.method_signature],

    [$._expression, $.property_signature, $._property_definition_list],

    [$.property_signature, $._property_definition_list],

    // < Type >
    //       ^ jsx_opening_element or type_parameter?
    [$.jsx_opening_element, $.type_parameter],

    [$.this_type, $.this_expression],

    [$.required_parameter, $._entity_name],
    [$._expression, $.required_parameter, $._entity_name],
    [$._expression, $._entity_name],

    [$.ambient_binding, $.variable_declarator],

    [$._expression, $.type_query],

    // let x: (string)
    //               ^ parenthesized_type or function_type
    [$.parameter_identifier, $.predefined_type],

    [$._entity_name, $.type_parameter],

    [$.jsx_opening_element, $._entity_name],
    [$.jsx_opening_element, $._entity_name, $.type_parameter],

    [$.type_reference],

    [$.export_statement, $.ambient_export_declaration],

    [$.function_call, $.math_op, $.rel_op],
    [$.function_call, $.bitwise_op, $.rel_op],
    [$.function_call, $.void_op, $.rel_op],
    [$.function_call, $.new_expression, $.rel_op],
    [$.function_call, $.bool_op, $.rel_op],
    [$.function_call, $.rel_op, $.type_op],

    [$._expression, $.method_signature],

    [$._property_definition_list, $._property_name],
    [$._property_definition_list, $._property_name, $._expression],

    [$.call_signature, $.function_type],
    [$.constructor_type, $.call_signature],

    [$._module, $._entity_name],

    [$._expression, $.import_alias],

    [$._expression, $.method_definition],

    [$.method_definition, $.reserved_identifier, $.ambient_method_declaration],
    [$.reserved_identifier, $.ambient_method_declaration],
    [$.reserved_identifier, $.module],
    [$.reserved_identifier, $.reserved_identifier],
    [$.reserved_identifier, $.ambient_declaration],
    [$.public_field_definition, $.reserved_identifier, $.ambient_method_declaration],
    [$.reserved_identifier, $.interface_declaration],
    [$.reserved_identifier, $.internal_module],

    [$.reserved_identifier, $.type_alias_declaration]
  ]),
  rules: {

    // Overrides
    public_field_definition: ($, previous) => seq(
      optional($.accessibility_modifier),
      optional('abstract'),
      optional('static'),
      optional($.readonly),
      $._property_name,
      optional('?'),
      optional($.type_annotation),
      optional($._initializer)),

    // TODO: Maybe remove this?
    math_op: ($, previous) => choice(
      prec.left(PREC.NEG, seq('-', $._expression)),
      prec.left(PREC.NEG, seq('+', $._expression)),
      prec.left(PREC.INC, seq($._expression, '++')),
      prec.left(PREC.INC, seq($._expression, '--')),
      prec.left(PREC.INC, seq('++', $._expression)),
      prec.left(PREC.INC, seq('--', $._expression)),
      prec.left(PREC.PLUS, seq($._expression, '+', $._expression)),
      prec.left(PREC.PLUS, seq($._expression, '-', $._expression)),
      prec.left(PREC.TIMES, seq($._expression, '*', $._expression)),
      prec.left(PREC.TIMES, seq($._expression, '/', $._expression)),
      prec.left(PREC.TIMES, seq($._expression, '%', $._expression))
    ),

    rel_op: ($, previous) => prec.left(PREC.REL, choice(
      seq($._expression, '<', $._expression),
      seq($._expression, '<=', $._expression),
      seq($._expression, '==', $._expression),
      seq($._expression, '===', $._expression),
      seq($._expression, '!=', $._expression),
      seq($._expression, '!==', $._expression),
      seq($._expression, '>=', $._expression),
      seq($._expression, '>', $._expression)
    )),

    _element_list: $ => seq(
      optional(','),
      commaSep1Trailing($._element_list, choice(
        $._expression,
        $.spread_element,
        $._empty_element
      ))
    ),

    _empty_element: $ => seq(''),

    function_call: ($, previous) => prec(PREC.FUNCTION_CALL, seq(
      choice($._expression, $.super, $.function),
      optional($.type_arguments),
      choice($.arguments, $.template_string)
    )),

    pair: ($, previous) => seq(
      choice($._property_name, $.accessibility_modifier),
      ':',
      $._expression
    ),

    _expression: ($, previous) => choice(
      $.type_assertion,
      $.as_expression,
      $.non_null_assertion_op,
      $.import_alias,
      $.internal_module,
      $.super,
      $.abstract_class,
      previous
    ),

    type_op: ($, previous) => choice(
      prec(PREC.TYPEOF, seq('typeof', choice($.anonymous_class, 'module'))),
      previous
    ),

    // Override import and export to support Flow 'import type' statements
    import_statement: ($, previous) => seq(
      'import',
      optional(choice('type', 'typeof')),
      choice(
        seq($.import_clause, $._from_clause),
        $.import_require_clause,
        $.string
      ),
      semicolon($)
    ),

    non_null_assertion_op: $ => prec.left(PREC.NON_NULL_ASSERTION_OP, seq(
      $._expression, '!'
    )),

    export_statement: ($, previous) => choice(
      seq('export', '*', $._from_clause, semicolon($)),
      seq('export', $.export_clause, $._from_clause, semicolon($)),
      seq('export', $.export_clause, semicolon($)),
      seq('export', $._declaration),
      seq('export', 'default', $.anonymous_class),
      seq('export', 'default', $._expression, semicolon($)),
      seq('export', '=', $.identifier, semicolon($)),
      seq('export', 'as', 'namespace', $.identifier, semicolon($)),
      seq('export', $.import_alias)
    ),

    // Exports that can appear in object types, namespace elements, modules, and interfaces
    ambient_export_declaration: $ => seq(
      'export',
      ambientDeclaration($)
    ),

    variable_declarator: ($, previous) => choice(
      seq($.identifier, optional($.type_annotation), optional($._initializer)),
      seq($.destructuring_pattern, optional($.type_annotation), $._initializer)
    ),

    ambient_method_declaration: $ => seq(
      optional($.accessibility_modifier),
      optional('abstract'),
      optional('static'),
      optional(choice('get', 'set', '*')),
      optional($.readonly),
      $._property_name,
      $.call_signature,
      semicolon($)
    ),

    _paren_expression: ($, previous) => seq(
      '(', choice(seq($._expression, optional($.type_annotation)), $.comma_op), ')'
    ),

    formal_parameters: ($, previous) => seq(
      '(',
      commaSep($._parameter),
      ')'
    ),

    ambient_function: $ => seq(
      'function',
      $.identifier,
      $.call_signature,
      semicolon($)
    ),

    function: ($, previous) => seq(
      optional($.reserved_identifier),
      'function',
      optional($.identifier),
      $.call_signature,
      $.statement_block
    ),

    generator_function: ($, prev) => seq(
      'function',
      '*',
      optional($.identifier),
      $.call_signature,
      $.statement_block
    ),

    arrow_function: $ => seq(
      choice(
        $.identifier,
        $.call_signature,
        optional($.reserved_identifier)
      ),
      '=>',
      choice(
        $._expression,
        $.statement_block
      )
    ),

    class_body: ($, previous) => seq(
      '{',
      repeat(
        choice(
          seq($.method_definition, optional(';')),
          $.ambient_method_declaration,
          seq($.public_field_definition, semicolon($)),
          seq($.index_signature, semicolon($))
        )
      ),
      '}'
    ),

    method_definition: $ => seq(
      optional($.accessibility_modifier),
      optional('static'),
      optional($.readonly),
      optional($.reserved_identifier),
      optional(choice('get', 'set', '*')),
      $._property_name,
      $.call_signature,
      $.statement_block
    ),

    // A function, generator, class, or variable declaration
    _declaration: ($, previous) => prec(PREC.DECLARATION, choice(
      $.function,
      $.ambient_function,
      $.generator_function,
      $.class,
      $.module,
      $.variable_declaration,
      $.lexical_declaration,
      $.type_alias_declaration,
      $.enum_declaration,
      $.interface_declaration,
      $.ambient_declaration
    )),

    type_assertion: $ => prec(PREC.TYPE_ASSERTION, seq(
      $.type_arguments,
      $._expression
    )),

    as_expression: $ => prec.left(PREC.AS_EXPRESSION, seq(
      optional($._expression),
      'as',
      choice($._type, $.template_string)
    )),

    class_heritage: ($, previous) => choice(
      seq($.extends_clause, optional($.implements_clause)),
      $.implements_clause
    ),

    // Additions

    import_require_clause: $ => seq($.identifier, '=', 'require', '(', $.string, ')'),

    implements_clause: $ => seq(
      'implements',
      commaSep1($.type_reference)
    ),

    ambient_declaration: $ => seq(
      'declare',
      choice(
        ambientDeclaration($),
        seq( 'global', '{', optional($.ambient_namespace_body), '}'))
    ),

    ambient_variable: $ => seq(
      variableType(),
      commaSep1($.ambient_binding),
      optional(seq("=", $._expression)),
      semicolon($)
    ),

    abstract_class: ($, previous) => seq(
      'abstract',
      'class',
      $.identifier,
      optional($.type_parameters),
      optional($.class_heritage),
      $.class_body
    ),

    class: ($, previous) => seq(
      'class',
      $.identifier,
      optional($.type_parameters),
      optional($.class_heritage),
      $.class_body
    ),

    _ambient_enum: $ => $.enum_declaration,

    ambient_namespace: $ => seq('namespace', $._entity_name, '{', optional($.ambient_namespace_body), '}'),

    module: $ => seq(
      'module',
      $._module
    ),

    internal_module: $ => seq(
      'namespace',
      $._module
    ),

    _module: $ => prec.right(seq(
      choice($.string, $.identifier, $._entity_name),
      optional($._module_body))
    ),

    _module_body: $ => seq(
      '{',
      repeat($._statement),
      '}'
    ),

    member_access: $ => prec(PREC.MEMBER, seq(
      choice($._expression, 'module'),
      '.',
      $.identifier
    )),

    _initializer: $ => seq(
      '=', choice($._expression, $.anonymous_class)
    ),

    ambient_namespace_body: $ => repeat1(choice(
      $.ambient_export_declaration,
      ambientDeclaration($),
      $.lexical_declaration,
      $.import_alias
    )),

    import_alias: $ => seq(
      'import',
      $.identifier,
      '=',
      $._entity_name,
      semicolon($)
    ),

    _entity_name: $ => prec.right(sepBy1('.', $.identifier)),

    ambient_binding: $ => seq(
      $.identifier,
      optional($.type_annotation)
    ),

    interface_declaration: $ => seq(
      'interface',
      $.identifier,
      optional($.type_parameters),
      optional($.extends_clause),
      $.object_type
    ),

    extends_clause: $ => seq(
      'extends',
      sepBy1(',', $.type_reference)
    ),

    enum_declaration: $ => seq(
      optional('const'),
      'enum',
      $.identifier,
      '{',
      optional($._enum_body),
      '}'
    ),

    _enum_body: $ => seq(
      seq(sepBy1(',', $._enum_member), optional(','))
    ),

    _enum_member: $ => choice(
      // TODO this should be a PropertyName
      $.identifier,
      $.enum_assignment
    ),

    enum_assignment: $ => seq(
      $.identifier,
      $._initializer
    ),

    type_alias_declaration: $ => seq(
      'type',
      $.identifier,
      optional($.type_parameters),
      '=',
      $._type,
      semicolon($)
    ),

    accessibility_modifier: $ => prec.left(PREC.ACCESSIBILITY, choice(
      'public',
      'private',
      'protected'
    )),

    readonly: $ => 'readonly',

    _parameter: $ => choice(
      $.required_parameter,
      $.rest_parameter,
      $.optional_parameter
    ),

    parameter_identifier: $ => choice(
      'any',
      'number',
      'boolean',
      'string',
      'symbol',
      'void'
      ),

    required_parameter: $ => choice(
      seq(
        optional($.accessibility_modifier),
        choice(pattern($), $.parameter_identifier),
        optional($.type_annotation),
        optional($._initializer)
      )
    ),

    optional_parameter: $ => choice(
      seq(
        optional($.accessibility_modifier),
        pattern($),
        '?',
        optional($.type_annotation)),
      seq(
        optional($.accessibility_modifier),
        pattern($),
        '?',
        optional($.type_annotation),
        $._initializer)
    ),

    rest_parameter: $ => seq(
      '...',
      $.identifier,
      optional($.type_annotation)
    ),

    type_annotation: $ => seq(
      ':', choice($._type, $._empty_element)
    ),

    _type: $ => choice(
      $._primary_type,
      $.union_type,
      $.intersection_type,
      $.function_type,
      $.constructor_type
    ),

    constructor_type: $ => seq(
      'new',
      optional($.type_parameters),
      $.formal_parameters,
      '=>',
      $._type
    ),

    _primary_type: $ => choice(
      $.parenthesized_type,
      $.predefined_type,
      $.type_reference,
      $.type_predicate,
      $.object_type,
      $.array_type,
      $.tuple_type,
      $.flow_maybe_type,
      $.type_query,
      $.index_type_query,
      $.this_type,
      $.existential_type,
      $.literal_type
    ),

    type_predicate: $ => seq(
      $.identifier,
      'is',
      $._type
    ),

    type_query: $ => seq(
      'typeof',
      $._entity_name
    ),

    index_type_query: $ => seq(
      'keyof',
      $._entity_name
    ),

    literal_type: $ => choice($.number, $.string, $.true, $.false),

    existential_type: $ => '*',

    this_type: $ => 'this',

    flow_maybe_type: $ => prec.right(seq( '?', $._primary_type )),

    parenthesized_type: $ => seq(
      '(', $._type, ')'
    ),

    predefined_type: $ => choice(
      'any',
      'number',
      'boolean',
      'string',
      'symbol',
      'void'
    ),

    type_arguments: $ => seq(
      '<', commaSep1($._type), '>'
    ),

    type_reference: $ => seq(
      $._entity_name,
      optional($.type_arguments)
    ),

    object_type: $ => seq(
      choice('{', '{|'), optional($._type_body), choice('}','|}')
    ),

    _type_body: $ => choice(
      $._type_member,
      seq(sepBy1(choice(',', semicolon($)), $._type_member), optional(choice(',', semicolon($))))
    ),

    _type_member: $ => prec.right(choice(
      $.ambient_export_declaration,
      $.property_signature,
      $.call_signature,
      $.construct_signature,
      $.index_signature,
      $.method_signature
    )),

    property_signature: $ => seq(
      optional($.accessibility_modifier),
      optional('static'),
      optional($.readonly),
      $._property_name,
      optional('?'),
      optional($.type_annotation)),

    call_signature: $ => seq(
      optional($.type_parameters),
      $.formal_parameters,
      optional($.type_annotation)
    ),

    type_parameters: $ => seq(
      '<', commaSep1($.type_parameter), '>'
    ),

    type_parameter: $ => seq(
      $.identifier,
      optional($.constraint)
    ),

    constraint: $ => seq(
      choice('extends', ':'),
      $._type
    ),

    construct_signature: $ => seq(
      'new',
      optional($.type_parameters),
      $.formal_parameters,
      optional($.type_annotation)
    ),

    index_signature: $ => choice(
      seq('[', $.identifier, ':', 'string', ']', $.type_annotation),
      seq('[', $.identifier, ':', 'number', ']', $.type_annotation)
    ),

    method_signature: $ => seq(
      optional($.accessibility_modifier),
      optional('static'),
      optional($.readonly),
      $._property_name,
      optional('?'),
      $.call_signature),

    array_type: $ => prec.right(PREC.ARRAY_TYPE, seq(
      $._primary_type, '[', ']'
    )),

    tuple_type: $ => seq(
      '[', commaSep1($._type), ']'
    ),

    union_type: $ => prec.left(PREC.UNION, seq(
      $._type, '|', $._type
    )),

    intersection_type: $ => prec.left(PREC.INTERSECTION, seq(
      $._type, '&', $._type
    )),

    function_type: $ => seq(
      optional($.type_parameters),
      $.formal_parameters,
      '=>',
      $._type
    ),

    reserved_identifier: ($, previous) => choice('declare', 'namespace', 'type', 'public', 'private', 'protected', previous)
  }
});

function commaSep1 (rule) {
  return sepBy1(',', rule);
}

function commaSep (rule) {
  return optional(commaSep1(rule));
}

function sepBy1 (sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

function sepBy (sep, rule) {
  return optional(sepBy1(sep, rule));
}

function pattern ($) {
  return choice($.identifier, $.destructuring_pattern)
}

function variableType() {
  return choice('var','let','const')
}

function ambientDeclaration($) {
  return choice(
    $.interface_declaration,
    $.ambient_variable,
    $.ambient_function,
    $.class,
    $._ambient_enum,
    $.ambient_namespace,
    $.module,
    $.type_alias_declaration
  )
}

function semicolon($) {
  return choice($._automatic_semicolon, ';')
}

function commaSep1Trailing(recurSymbol, rule) {
  return seq(rule, optional(seq(',', optional(recurSymbol))))
}
