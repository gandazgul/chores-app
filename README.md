# Tow

Tow is a household chore app for steady recurring chore management.

## Features

- Add, edit, and delete chores
- Mark chores as complete
- User authentication
- Assigned Chore Push Notifications through Gotify

## Project Structure

The project is built with Astro and Deno. It uses Google Sign-In for
authentication, SQLite through `node:sqlite` for data storage, and an in-process
scheduler for assigned Chore Nags.

## Installation

To get started with the project, clone the repository and install the
dependencies:

```bash
git clone https://github.com/gandazgul/chores-app.git
cd chores-app
deno install
```

## Usage

### Running the development server:

```bash
deno run dev
```

This will start the development server. Open
[http://localhost:5173](http://localhost:5173) (or the port specified in your
console) to view it in the browser.

### Building for production:

```bash
deno run build
```

This command builds the app for production to the `dist` folder. It correctly
bundles the application in production mode and optimizes the build for the best
performance. The build is minified, and the filenames include hashes. Your app
is ready to be deployed!

### Running the container locally:

The application can also be run locally using the provided `Containerfile` via
Docker or Podman:

```bash
# Build the container image
docker build -f Containerfile -t chores-app .

# Run the container
docker run -p 8080:8080 --env-file .env chores-app
```

This will run the built production application on `http://localhost:8080`. Mount
`chores.db` on a persistent volume in production. The scheduler assumes one app
process and one SQLite writer.

## Notifications

Tow sends assigned Chore Nags through Gotify. Configure `GOTIFY_URL` and each
Member's Gotify Application Token. Set `ENABLE_NOTIFICATIONS=false` to stop the
scheduler, Delivery Slot creation, and sends. Quiet Hours default to
`21:00`-`08:00` in `HOUSEHOLD_TZ` and can be changed with `QUIET_HOURS_START`
and `QUIET_HOURS_END` in `HH:MM` format. Delivery is at least once, so a crash
after Gotify accepts a message can create one duplicate external message.

## Contributing

We welcome contributions to Tow. If you'd like to contribute, please follow
these guidelines:

### Reporting Bugs

- Check the existing issues to see if the bug has already been reported.
- If not, open a new issue. Be sure to include a clear title, a detailed
  description of the bug, steps to reproduce it, and any relevant screenshots.

### Suggesting Enhancements

- Open a new issue to discuss your enhancement idea.
- Provide a clear title and a detailed description of the proposed enhancement
  and its benefits.

### Submitting Pull Requests

1. Fork the repository.
2. Create a new branch for your feature or bug fix:
   `git checkout -b feature/your-feature-name` or
   `git checkout -b fix/your-bug-fix-name`.
3. Make your changes and commit them with a clear and descriptive commit
   message.
4. Push your changes to your forked repository:
   `git push origin feature/your-feature-name`.
5. Open a pull request to the `main` branch of the original repository.
6. Ensure your PR description clearly explains the changes and why they are
   needed.
7. Link any relevant issues in your PR description.

## Acknowledgments

This project was created with help from
[opencode](https://github.com/opencodeco/opencode) and Gemini.

## License

This project is licensed under the terms of the MIT [LICENSE](LICENSE).
