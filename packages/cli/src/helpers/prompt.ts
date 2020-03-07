import Chalk from 'chalk';
const { prompt, AutoComplete } = require('enquirer');
import Firebase from './firebase';

export default {
  /* ---------------
   *     GENERIC
   * -------------- */

  /**
   * Generic ask a question - resolves true or false
   *
   * @param message
   * @param prefix
   * @returns {Promise<ok|boolean>}
   */
  async confirm(message: string, prefix?: string): Promise<boolean> {
    return (await prompt({
      message,
      type: 'confirm',
      prefix: `[${prefix || '🤔'}]`,
      initial: true,
      name: 'confirmed',
    })).confirmed;
  },

  /**
   * Prompt the user to select an item from a array
   *
   * @param message
   * @param choices
   * @param prefix
   * @returns {Promise<*>}
   */
  async selectOneFromArray(
    message: string,
    choices: string[],
    prefix: string = '🔥',
  ): Promise<string> {
    const prompt = new AutoComplete({
      choices,
      message,
      name: 'choice',
      limit: 6,
      prefix: `[${prefix}]`,
      footer: Chalk.bgGreen(
        Chalk.grey('Start typing to filter choices, use arrow keys to navigate & ENTER to select'),
      ),
    });
    return prompt.run();
  },

  /**
   * Prompts the user to start typing and narrows down results to match the typed input
   *
   * @param message
   * @param source
   * @param prefix
   * @param suggestOnly
   * @returns {Promise<*>}
   */
  async selectOneFromAutoComplete(
    message: string,
    source?: (answersSoFar: string[], input: string) => Promise<unknown>, // todo proper type
    prefix = '',
    suggestOnly?: boolean,
  ) {
    return (await prompt({
      message,
      type: 'autocomplete',
      name: 'choice',
      pageSize: 12,
      prefix: `[${prefix}]`,
      source: async (answersSoFar: string[], input: string) => {
        return source ? await source(answersSoFar, input) : () => {};
      },
      suggestOnly: !!suggestOnly,
    })).choice;
  },

  /**
   * TODO api error handling
   *
   * @returns {Promise<*>}
   */
  async selectFirebaseProject(account: any) {
    const apiResponse = await Firebase.api(
      account || Firebase.auth.getAccount(),
    ).management.getProjects();

    const projectsWithId: any[] = [];

    const choices = apiResponse.results.map((project: any) => {
      const { projectId, displayName } = project;
      projectsWithId.push({ projectId, ...project });
      return {
        name: displayName !== projectId ? `${displayName} (${projectId})` : displayName,
        value: projectId,
      };
    });

    if (!choices.length) {
      return null;
    }

    const selectedProjectId = await module.exports.selectOneFromArray(
      `Select a Firebase ${Chalk.cyanBright('[projectId]')}:`,
      choices,
    );

    return projectsWithId.filter(projects => projects.projectId === selectedProjectId)[0];
  },

  /**
   * Select an authenticated firebase account by email
   *
   * @returns {Promise<*>}
   */
  async selectFirebaseAccount(allowAll = false, promptToAdd = true) {
    let accounts = Firebase.auth.getAccounts();

    if (promptToAdd) {
      // only one account so default to that one
      if (accounts.length === 1) {
        if (
          !(await module.exports.confirm(
            'You only have one account to select from. Add another Firebase account?',
          ))
        ) {
          return accounts[0];
        }

        await Firebase.auth.authWithBrowser();

        accounts = Firebase.auth.getAccounts();
      }

      // no accounts so ask to add one
      if (!accounts.length) {
        if (
          await module.exports.confirm(
            'No accounts found - would you like to add a new Firebase Console account?',
          )
        ) {
          await Firebase.auth.authWithBrowser();
        } else {
          return null;
        }

        accounts = Firebase.auth.getAccounts();

        // only one account so default to that one
        if (accounts.length === 1) {
          return accounts[0];
        }
      }
    }

    if (allowAll) {
      accounts = accounts.length ? ['all', ...accounts] : ['all'];
    }

    const choices = accounts.map((account: any, i: number) => {
      if (account === 'all') {
        return { name: account, value: i };
      }
      const { user } = account;
      return {
        name: user.email,
        value: i,
      };
    });

    return accounts[
      await module.exports.selectOneFromArray('Select a Firebase Console account:', choices, '🔐')
    ];
  },
};
