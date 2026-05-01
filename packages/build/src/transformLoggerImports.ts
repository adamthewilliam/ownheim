const RUNTIME_SPECIFIER = '@strays/runtime';
const FACTORY_MAP: Record<string, string> = {
  logger: 'createLogger',
  tracer: 'createTracer',
};

const IMPORT_REGEX =
  /import\s*\{\s*([^}]+?)\s*\}\s*from\s*(['"])(@strays\/runtime|@strays\/runtime\/(?:logger|tracer|createLogger|createTracer))\2\s*;?/g;

export function transformLoggerImports(source: string): string {
  return source.replace(IMPORT_REGEX, (full, namedRaw, quote, _spec) => {
    const named = parseNamedImports(String(namedRaw));
    const passthrough: string[] = [];
    const replacements: string[] = [];

    for (const { name, alias } of named) {
      const factory = FACTORY_MAP[name];
      if (factory) {
        const localName = alias ?? name;
        replacements.push(
          `import { ${factory} } from ${quote}${RUNTIME_SPECIFIER}/${factory}${quote};\nconst ${localName} = ${factory}(typeof __OWNER__ === 'string' ? __OWNER__ : '');`,
        );
      } else {
        passthrough.push(alias ? `${name} as ${alias}` : name);
      }
    }

    if (passthrough.length > 0) {
      replacements.unshift(
        `import { ${passthrough.join(', ')} } from ${quote}${RUNTIME_SPECIFIER}${quote};`,
      );
    }

    return replacements.join('\n');
  });
}

interface ParsedImport {
  readonly name: string;
  readonly alias?: string;
}

function parseNamedImports(raw: string): ParsedImport[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const asMatch = part.match(/^(\S+)\s+as\s+(\S+)$/);
      if (asMatch) return { name: asMatch[1]!, alias: asMatch[2]! };
      return { name: part };
    });
}
