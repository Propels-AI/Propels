<div align="center">
  <img src="https://raw.githubusercontent.com/Propels-AI/Propels/main/apps/extension/icons/icon-dark-128.png" width="128" height="128">
  <h1>Propels</h1>
  <p>Turn your website visitors into revenue with interactive product demos.</p>
</div>

Propels is an open-source tool that helps you replace static "Book a Demo" buttons with engaging, interactive product demos. It's designed to let your website visitors experience the 'aha' moment of your product instantly, turning passive readers into a qualified customers.

## How It Works

Propels turns your readers into revenue in 3 simple steps:

1.  **Record**: Use the Propels Chrome extension to record an interactive demo of your product.
2.  **Embed**: Embed the demo directly onto your marketing blog or landing page.
3.  **Capture**: Use the built-in lead form to capture high-intent leads who have already seen the value in your product.

## Getting Started for Developers

Interested in contributing to Propels? Here’s how to get the development environment running on your local machine.

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/Propels-AI/Propels.git
    cd Propels/app
    ```

2.  **Install dependencies:**
    This project uses `pnpm` as its package manager. Run this command from the root of the `app` directory.
    ```sh
    pnpm install
    ```

3.  **Run the backend sandbox:**
    In a separate terminal, start the Amplify sandbox to run the backend services locally.
    ```sh
    npx ampx sandbox --stream-function-logs
    ```
    This requires an AWS profile to be configured on your machine. For more information on setting this up, please visit the [official Amplify documentation](https://docs.amplify.aws/react/start/quickstart/#make-backend-updates).

4.  **Run the development server (Frontend):**
    This command starts the web application.
    ```sh
    pnpm run dev
    ```
    The web app will be available at `http://localhost:5173`.

## Contributing

We welcome contributions from the community! As an early-stage project, we are open to all kinds of help.

Here’s how you can contribute:
- **Propose a New Feature**: Have an idea? Fork the repo, build a prototype, and submit a pull request. We'd love to see it.
- **Fix an Issue**: Check our open issues. If you see something you'd like to fix, please comment on the issue to let us know you're working on it.

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0). See the [LICENSE](LICENSE) file for more details.
