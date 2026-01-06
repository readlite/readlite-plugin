module.exports = {
  franc: (text) => (text && text.includes("Chinese") ? "cmn" : "eng"),
};
