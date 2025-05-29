# Chores App

A simple and efficient application to manage your daily tasks and chores.

## Features

- Add, edit, and delete tasks
- Mark tasks as complete
- User authentication

## Project Structure

The project is built using SolidJS, Vite, PicoCSS and Firebase. It uses pnpm as the package manager. The main components are located in the `src/components` directory.

## Installation

To get started with the project, clone the repository and install the dependencies:

```bash
git clone https://github.com/gandazgul/chores-app.git
cd chores-app
pnpm install
```

## Usage

### Running the development server:

```bash
pnpm dev
```
This will start the development server. Open [http://localhost:5173](http://localhost:5173) (or the port specified in your console) to view it in the browser.

### Building for production:

```bash
pnpm build
```
This command builds the app for production to the `dist` folder. It correctly bundles the application in production mode and optimizes the build for the best performance. The build is minified, and the filenames include hashes. Your app is ready to be deployed!

## Contributing

We welcome contributions to the Chores App! If you'd like to contribute, please follow these guidelines:

### Reporting Bugs

- Check the existing issues to see if the bug has already been reported.
- If not, open a new issue. Be sure to include a clear title, a detailed description of the bug, steps to reproduce it, and any relevant screenshots.

### Suggesting Enhancements

- Open a new issue to discuss your enhancement idea.
- Provide a clear title and a detailed description of the proposed enhancement and its benefits.

### Submitting Pull Requests

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix: `git checkout -b feature/your-feature-name` or `git checkout -b fix/your-bug-fix-name`.
3.  Make your changes and commit them with a clear and descriptive commit message.
4.  Push your changes to your forked repository: `git push origin feature/your-feature-name`.
5.  Open a pull request to the `main` branch of the original repository.
6.  Ensure your PR description clearly explains the changes and why they are needed.
7.  Link any relevant issues in your PR description.

## License

This project is licensed under the terms of the MIT [LICENSE](LICENSE).
