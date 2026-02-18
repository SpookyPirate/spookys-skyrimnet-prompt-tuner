import {
  StreamLanguage,
  StringStream,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * Custom CodeMirror syntax mode for Inja templates.
 * Handles: {{ expressions }}, {% control flow %}, {# comments #}, [ section markers ]
 */

interface InjaState {
  inExpression: boolean;
  inControl: boolean;
  inComment: boolean;
  inSectionMarker: boolean;
}

const injaMode = StreamLanguage.define<InjaState>({
  startState(): InjaState {
    return {
      inExpression: false,
      inControl: false,
      inComment: false,
      inSectionMarker: false,
    };
  },

  token(stream: StringStream, state: InjaState): string | null {
    // Inside a comment {# ... #}
    if (state.inComment) {
      const end = stream.match(/#\}/, true);
      if (end) {
        state.inComment = false;
        return "comment";
      }
      stream.next();
      return "comment";
    }

    // Inside expression {{ ... }}
    if (state.inExpression) {
      if (stream.match(/\}\}/, true)) {
        state.inExpression = false;
        return "keyword";
      }
      // Function names
      if (
        stream.match(
          /\b(render_template|render_subcomponent|render_character_profile|decnpc|get_scene_context|get_recent_events|get_relevant_memories|get_nearby_npc_list|units_to_meters|length|contains|join|lower|upper|replace|to_string|exists|existsIn|default|first|last|range)\b/,
          true
        )
      ) {
        return "function";
      }
      // String literals
      if (stream.match(/"[^"]*"/, true) || stream.match(/'[^']*'/, true)) {
        return "string";
      }
      // Numbers
      if (stream.match(/\b\d+(\.\d+)?\b/, true)) {
        return "number";
      }
      // Operators
      if (stream.match(/\b(and|or|not|in|is)\b/, true)) {
        return "operator";
      }
      // Dots, pipes
      if (stream.match(/[|.]/, true)) {
        return "operator";
      }
      // Variable names
      if (stream.match(/[a-zA-Z_]\w*/, true)) {
        return "variableName";
      }
      stream.next();
      return "variableName";
    }

    // Inside control {% ... %}
    if (state.inControl) {
      if (stream.match(/%\}/, true)) {
        state.inControl = false;
        return "keyword";
      }
      // Control keywords
      if (
        stream.match(
          /\b(if|else if|else|endif|for|endfor|set|block|endblock|in)\b/,
          true
        )
      ) {
        return "keyword";
      }
      // String literals
      if (stream.match(/"[^"]*"/, true) || stream.match(/'[^']*'/, true)) {
        return "string";
      }
      // Numbers
      if (stream.match(/\b\d+(\.\d+)?\b/, true)) {
        return "number";
      }
      // Operators
      if (stream.match(/\b(and|or|not|in|is)\b/, true)) {
        return "operator";
      }
      if (stream.match(/[=!<>]=?/, true)) {
        return "operator";
      }
      // Variable names
      if (stream.match(/[a-zA-Z_]\w*/, true)) {
        return "variableName";
      }
      stream.next();
      return "meta";
    }

    // Start of comment
    if (stream.match(/\{#/, true)) {
      state.inComment = true;
      return "comment";
    }

    // Start of expression
    if (stream.match(/\{\{/, true)) {
      state.inExpression = true;
      return "keyword";
    }

    // Start of control
    if (stream.match(/\{%/, true)) {
      state.inControl = true;
      return "keyword";
    }

    // Section markers: [ system ], [ user ], [ assistant ], [ cache ], [ end X ]
    if (stream.sol() || stream.peek() === "[") {
      if (
        stream.match(
          /\[\s*(system|user|assistant|cache|end\s+system|end\s+user|end\s+assistant|end\s+cache)\s*\]/,
          true
        )
      ) {
        return "heading";
      }
    }

    // Plain text
    stream.next();
    return null;
  },
});

export { injaMode };
