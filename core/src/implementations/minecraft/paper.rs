use color_eyre::eyre::{eyre, Context, ContextCompat};
use serde_json::Value;

use crate::error::Error;

pub async fn get_paper_minecraft_versions() -> Result<Vec<String>, Error> {
    let http = reqwest::Client::new();

    let response: Value = serde_json::from_str(
        http.get("https://fill.papermc.io/v3/projects/paper")
            .send()
            .await
            .context("Failed to get paper versions")?
            .text()
            .await
            .context("Failed to get paper versions")?
            .as_str(),
    )
    .context("Failed to get paper versions, response is not valid json")?;

    // v3 API: versions is an object { "26.1": ["26.1.2", ...], "1.21": [...] }
    let versions_obj = response
        .get("versions")
        .context("Failed to get paper versions, response does not contain versions")?
        .as_object()
        .context("Failed to get paper versions, versions is not an object")?;

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

    versions.sort_by(|a, b| compare_versions(b, a)); // newest first

    Ok(versions)
}

fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |s: &str| {
        s.split('.')
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    let a_parts = parse(a);
    let b_parts = parse(b);
    a_parts.cmp(&b_parts)
}

#[cfg(test)]
mod test {
    use super::*;

    #[tokio::test]
    async fn test_get_paper_minecraft_versions() {
        let versions = get_paper_minecraft_versions().await.unwrap();
        assert!(versions.contains(&"1.16.5".to_string()));
    }
}
