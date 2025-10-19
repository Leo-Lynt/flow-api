/**
 * Retorna exemplo de valor para um tipo de dado
 * Se defaultValue for fornecido, usa ele, senão usa exemplo genérico
 */
function getExampleForType(type, defaultValue) {
  // Se tem defaultValue, usa ele
  if (defaultValue !== undefined && defaultValue !== null) {
    return defaultValue;
  }

  // Senão usa exemplos genéricos
  const examples = {
    string: "example text",
    number: 42,
    boolean: true,
    array: ["item1", "item2"],
    object: { key: "value" },
    any: "any value"
  };
  return examples[type] || examples.any;
}

module.exports = {
  getExampleForType
};
