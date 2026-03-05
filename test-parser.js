import * as acorn from 'acorn';
import jsx from 'acorn-jsx';

try {
    const JSXParser = acorn.Parser.extend(jsx());
    const code = "(<Frame name='test' />)";
    const ast = JSXParser.parse(code, {
        ecmaVersion: 2020,
        sourceType: 'module',
    });
    console.log('Success:', JSON.stringify(ast.body[0].expression.type));
} catch (err) {
    console.error('Error:', err.message);
}
