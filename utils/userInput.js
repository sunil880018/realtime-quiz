const prompt = require('prompt-sync')({ sigint: true });

async function getUserChoice(data) {
  let choice;
  while (true) {
    choice = parseInt(prompt('Enter your choice index: '));
    if (
      !isNaN(choice) &&
      choice >= 0 &&
      choice < data?.question?.options?.length
    ) {
      return choice;
    }
    console.log('Invalid input, try again.');
  }
}
module.exports = { getUserChoice };
