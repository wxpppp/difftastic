/*
* taken from https://raw.githubusercontent.com/tree-sitter/tree-sitter/master/test/fuzz/fuzzer.cc
*/

#include <cassert>
#include <fstream>
#include "tree_sitter/api.h"

extern "C" const TSLanguage *tree_sitter_hcl();

static TSQuery *lang_query;

extern "C" int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  const char *str = reinterpret_cast<const char *>(data);

  TSParser *parser = ts_parser_new();

  // This can fail if the language version doesn't match the runtime version
  bool language_ok = ts_parser_set_language(parser, tree_sitter_hcl());
  assert(language_ok);

  TSTree *tree = ts_parser_parse_string(parser, NULL, str, size);
  TSNode root_node = ts_tree_root_node(tree);

  if (lang_query) {
    {
      TSQueryCursor *cursor = ts_query_cursor_new();

      ts_query_cursor_exec(cursor, lang_query, root_node);
      TSQueryMatch match;
      while (ts_query_cursor_next_match(cursor, &match)) {
      }

      ts_query_cursor_delete(cursor);
    }

    {
      TSQueryCursor *cursor = ts_query_cursor_new();

      ts_query_cursor_exec(cursor, lang_query, root_node);
      TSQueryMatch match;
      uint32_t capture_index;
      while (ts_query_cursor_next_capture(cursor, &match, &capture_index)) {
      }

      ts_query_cursor_delete(cursor);
    }
  }

  ts_tree_delete(tree);
  ts_parser_delete(parser);

  return 0;
}
