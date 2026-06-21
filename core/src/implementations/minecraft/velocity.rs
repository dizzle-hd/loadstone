use color_eyre::eyre::{eyre, Context, ContextCompat};
use serde_json::Value;

use crate::error::Error;

pub async fn get_velocity_versions() -> Result<Vec<String>, Error> {
    let http = reqwest::Client::new();

    let response: Value = serde_json::from_str(
        http.get("https://api.papermc.io/v2/projects/velocity")
            .send()
            .await
            .context("Failed to get velocity versions")?
            .text()
            .await
            .context("Failed to get velocity versions")?
            .as_str(),
    )
    .context("Failed to get velocity versions, response is not valid json")?;

    let mut versions = response
        .get("versions")
        .context("Failed to get velocity versions, response does not contain versions")?
        .as_array()
        .context("Failed to get velocity versions, response is not an array")?
        .iter()
        .map(|version| {
            version
                .as_str()
                .ok_or_else(|| eyre!("Version string is not a string").into())
                .map(|v| v.to_string())
        })
        .collect::<Result<Vec<String>, Error>>()?;

    versions.reverse();

    Ok(versions)
}
