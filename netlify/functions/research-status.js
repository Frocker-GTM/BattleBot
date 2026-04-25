const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { job_id } = JSON.parse(event.body);

    const { data, error } = await supabase
      .from('research_results')
      .select('job_id, mode, competitor, product_name, result, status, created_at')
      .eq('job_id', job_id)
      .single();

    if (error) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'not_found', error: error.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        job_id: data.job_id,
        mode: data.mode,
        competitor: data.competitor,
        product_name: data.product_name,
        status: data.status,
        result: data.result,
        created_at: data.created_at
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};