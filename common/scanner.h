#include <tree_sitter/parser.h>
#include <wctype.h>

enum TokenType {
  AUTOMATIC_SEMICOLON,
  TEMPLATE_CHARS,
  BINARY_OPERATORS,
  FUNCTION_SIGNATURE_AUTOMATIC_SEMICOLON,
};

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static bool scan_template_chars(TSLexer *lexer) {
  lexer->result_symbol = TEMPLATE_CHARS;
  for (bool has_content = false;; has_content = true) {
    lexer->mark_end(lexer);
    switch (lexer->lookahead) {
    case '`':
      return has_content;
    case '\0':
      return false;
    case '$':
      advance(lexer);
      if (lexer->lookahead == '{') return has_content;
      break;
    case '\\':
      return has_content;
    default:
      advance(lexer);
    }
  }
}

static bool scan_whitespace_and_comments(TSLexer *lexer) {
  for (;;) {
    while (iswspace(lexer->lookahead)) {
      advance(lexer);
    }

    if (lexer->lookahead == '/') {
      advance(lexer);

      if (lexer->lookahead == '/') {
        advance(lexer);
        while (lexer->lookahead != 0 && lexer->lookahead != '\n') {
          advance(lexer);
        }
      } else if (lexer->lookahead == '*') {
        advance(lexer);
        while (lexer->lookahead != 0) {
          if (lexer->lookahead == '*') {
            advance(lexer);
            if (lexer->lookahead == '/') {
              advance(lexer);
              break;
            }
          } else {
            advance(lexer);
          }
        }
      } else {
        return false;
      }
    } else {
      return true;
    }
  }
}

static inline bool external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  if (valid_symbols[TEMPLATE_CHARS]) {
    if (valid_symbols[AUTOMATIC_SEMICOLON]) return false;
    return scan_template_chars(lexer);
  } else if (
    valid_symbols[AUTOMATIC_SEMICOLON] ||
    valid_symbols[FUNCTION_SIGNATURE_AUTOMATIC_SEMICOLON]
  ) {
    lexer->result_symbol = AUTOMATIC_SEMICOLON;
    lexer->mark_end(lexer);

    for (;;) {
      if (lexer->lookahead == 0) return true;
      if (lexer->lookahead == '}') {
        // Automatic semicolon insertion breaks detection of object patterns
        // in a typed context:
        //   type F = ({a}: {a: number}) => number;
        // Therefore, disable automatic semicolons when followed by typing
        do {
          advance(lexer);
        } while (iswspace(lexer->lookahead));
        if (lexer->lookahead == ':') return false;
        return true;
      }
      if (!iswspace(lexer->lookahead)) return false;
      if (lexer->lookahead == '\n') break;
      advance(lexer);
    }

    advance(lexer);

    if (!scan_whitespace_and_comments(lexer)) return false;

    switch (lexer->lookahead) {
      case ',':
      case '.':
      case ';':
      case '*':
      case '%':
      case '>':
      case '<':
      case '=':
      case '?':
      case '^':
      case '|':
      case '&':
      case '/':
      case ':':
        return false;

      case '{':
        if (valid_symbols[FUNCTION_SIGNATURE_AUTOMATIC_SEMICOLON]) return false;
        break;

      // Don't insert a semicolon before a '[' or '(', unless we're parsing
      // a type. Detect whether we're parsing a type or an expression using
      // the validity of a binary operator token.
      case '(':
      case '[':
        if (valid_symbols[BINARY_OPERATORS]) return false;
        break;

      // Insert a semicolon before `--` and `++`, but not before binary `+` or `-`.
      case '+':
        advance(lexer);
        return lexer->lookahead == '+';
      case '-':
        advance(lexer);
        return lexer->lookahead == '-';

      // Don't insert a semicolon before `!=`, but do insert one before a unary `!`.
      case '!':
        advance(lexer);
        return lexer->lookahead != '=';

      // Don't insert a semicolon before `in` or `instanceof`, but do insert one
      // before an identifier.
      case 'i':
        advance(lexer);

        if (lexer->lookahead != 'n') return true;
        advance(lexer);

        if (!iswalpha(lexer->lookahead)) return false;

        for (unsigned i = 0; i < 8; i++) {
          if (lexer->lookahead != "stanceof"[i]) return true;
          advance(lexer);
        }

        if (!iswalpha(lexer->lookahead)) return false;
        break;
    }

    return true;
  } else {
    return false;
  }
}
