use color_eyre::eyre::{Context, ContextCompat};
use serde_json::Value;

use crate::error::Error;

pub async fn get_velocity_versions() -> Result<Vec<String>, Error> {
    let http = reqwest::Client::new();

    let response: Value = serde_json::from_str(
        http.get("https://fill.papermc.io/v3/projects/velocity")
            .send()
            .await
            .context("Failed to get velocity versions")?
            .text()
            .await
            .context("Failed to get velocity versions")?
            .as_str(),
    )
    .context("Failed to get velocity versions, response is not valid json")?;

    // v3 API: versions is an object { "3.0.0": ["3.4.0-SNAPSHOT", ...], ... }
    let versions_obj = response
        .get("versions")
        .context("Failed to get velocity versions, response does not contain versions")?
        .as_object()
        .context("Failed to get velocity versions, versions is not an object")?;

    let mut versions: Vec<String> = versions_obj
        .values()
        .flat_map(|arr| {
            arr.as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default()
        })
        .collect();

    versions.reverse();

    Ok(versions)
}
