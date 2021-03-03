const {parens} = require('./util.js')

module.exports = {
  // ------------------------------------------------------------------------
  // type
  // ------------------------------------------------------------------------

  type_variable: $ => $._varid,

  annotated_type_variable: $ => parens($.type_variable, $._type_annotation),

  _tyvar: $ => choice(
    $.annotated_type_variable,
    $.type_variable,
  ),

  _forall_kw: _ => choice('forall', '∀'),

  _forall_dot: _ => choice('.', '->'),

  _forall: $ => seq(
    $._forall_kw,
    repeat1($._tyvar),
  ),

  _quantifiers: $ => seq(
    alias($._forall, $.quantifiers),
    $._forall_dot,
  ),

  forall: $ => $._quantifiers,

  type_parens: $ => parens($._type),

  type_list: $ => brackets(sep1($.comma, $._type)),

  type_tuple: $ => parens(sep2($.comma, $._type)),

  _type_promotable_literal: $ => choice(
    $.type_literal,
    $.type_tuple,
    $.type_list,
  ),

  _type_promoted_literal: $ => seq(quote, $._type_promotable_literal),

  _type_literal: $ => choice(
    alias($._type_promoted_literal, $.promoted),
    $._type_promotable_literal,
  ),

  strict_type: $ => seq($._strict, $._atype),

  type_name: $ => choice(
    $._tyvar,
    $._gtycon,
  ),

  type_star: _ => '*',

  _atype: $ => choice(
    $.type_name,
    $.type_star,
    $._type_literal,
    $.type_parens,
  ),

  /**
   * Type application, as in `Either e (Int, Text)`.
   */
  type_apply: $ => seq($._atype, repeat1($._atype)),

  /**
   * The point of this `choice` is to get a node for type application only if there is more than one atype present.
   */
  _btype: $ => choice(
    $._atype,
    $.type_apply,
  ),

  type_infix: $ => seq(
    field('left', $._btype),
    field('op', $._qtyconop),
    field('right', $._type_infix),
  ),

  _type_infix: $ => choice(
    $.type_infix,
    $._btype,
  ),

  implicit_param: $ => seq(
    $.implicit_parid,
    $._type_annotation,
  ),

  constraint: $ => choice(
    seq(field('class', alias($.type_name, $.class_name)), repeat($._atype)),
    $.type_infix,
  ),

  _quantified_constraint: $ => seq($._quantifiers, $._constraint),

  _constraint_context: $ => seq($._context, $._constraint),

  _constraint: $ => choice(
    alias($._quantified_constraint, $.forall),
    alias($._constraint_context, $.context),
    $.constraint,
  ),

  _context_constraints: $ => seq(
    choice(
      $.constraint,
      prec('context-empty', parens(optional(sep1($.comma, choice($._constraint, $.implicit_param))))),
    ),
  ),

  _context: $ => seq($._context_constraints, '=>'),

  context: $ => $._context,

  _type_quantifiers: $ => seq($._quantifiers, $._type),

  _type_context: $ => seq($._context, $._type),

  _type_fun: $ => prec('function-type', seq($._type_infix, '->', $._type)),

  _type: $ => prec('type', choice(
    alias($._type_quantifiers, $.forall),
    alias($._type_context, $.context),
    alias($._type_fun, $.fun),
    $._type_infix,
  )),

  _type_annotation: $ => seq(
    '::',
    field('type', $._type),
  ),

  _simpletype_infix: $ => seq(
    $._tyvar,
    field('name', $._simple_tyconop),
    $._tyvar,
  ),

  _simpletype: $ => choice(
    parens($._simpletype),
    alias($._simpletype_infix, $.type_infix),
    seq(
      field('name', $._simple_tycon),
      repeat($._tyvar),
    ),
  ),

  // ------------------------------------------------------------------------
  // type decl
  // ------------------------------------------------------------------------

  decl_type: $ => seq(
    'type',
    $._simpletype,
    '=',
    $._type,
  ),

  decl_type_sig: $ => seq(
    'type',
    optional('family'),
    $._simpletype,
    $._type_annotation,
  ),

  // ------------------------------------------------------------------------
  // type family
  // ------------------------------------------------------------------------

  tyfam_head: $ => $._simpletype,

  _tyfam_pat_prefix: $ => seq(
    field('name', $._qtyconid),
    repeat($._atype),
  ),

  _tyfam_pat_infix: $ => seq(
    $._atype,
    field('op', $._qtyconop),
    $._atype,
  ),

  tyfam_pat: $ => choice(
    $._tyfam_pat_prefix,
    $._tyfam_pat_infix,
  ),

  tyfam_eq: $ => seq(
    alias($.tyfam_pat, $.pattern),
    '=',
    $._type,
  ),

  decl_tyfam: $ => seq(
    'type',
    'family',
    alias($.tyfam_head, $.head),
    optional($._type_annotation),
    optional(where($, alias($.tyfam_eq, $.equation))),
  ),

  decl_tyinst: $ => seq(
    'type',
    'instance',
    repeat($._atype),
    '=',
    $._type,
  ),
}
