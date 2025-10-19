/**
 * Calcula o tamanho em bytes de um objeto quando serializado em JSON
 */
function calculateObjectSize(obj) {
  if (!obj) return 0;
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

module.exports = {
  calculateObjectSize
};
